import {
  polylineLength,
  rectOf,
  segmentIntersectsRect,
  segmentsFromPoints
} from './geometry.mjs';
import { createQualityReport } from './quality-report.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';
import { placeEdgeLabels } from './place-edge-labels.mjs';

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function clone(value) {
  return structuredClone(value);
}

function semanticElements(scene, role) {
  return (scene?.elements ?? []).filter((element) => metaOf(element).role === role);
}

function bySemanticId(elements) {
  return new Map(elements.map((element) => [metaOf(element).semanticId, element]));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function anchor(node, side, offset = 0) {
  if (side === 'right') {
    return {
      x: node.x + node.width,
      y: clamp(node.y + node.height / 2 + offset, node.y + 12, node.y + node.height - 12)
    };
  }
  if (side === 'left') {
    return {
      x: node.x,
      y: clamp(node.y + node.height / 2 + offset, node.y + 12, node.y + node.height - 12)
    };
  }
  if (side === 'down') {
    return {
      x: clamp(node.x + node.width / 2 + offset, node.x + 12, node.x + node.width - 12),
      y: node.y + node.height
    };
  }
  return {
    x: clamp(node.x + node.width / 2 + offset, node.x + 12, node.x + node.width - 12),
    y: node.y
  };
}

function outward(point, side, distance = 40) {
  if (side === 'right') return { x: point.x + distance, y: point.y };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  return { x: point.x, y: point.y - distance };
}

function dedupe(points) {
  return points.filter((point, index) => {
    return index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y;
  });
}

function isOrthogonal(points) {
  for (let index = 1; index < points.length; index += 1) {
    const first = points[index - 1];
    const second = points[index];
    if (first.x !== second.x && first.y !== second.y) return false;
  }
  return true;
}

function horizontalSide(side) {
  return side === 'left' || side === 'right';
}

function simpleRoutes(start, end, sourceSide, targetSide) {
  const sourceHorizontal = horizontalSide(sourceSide);
  const targetHorizontal = horizontalSide(targetSide);
  const routes = [];

  if (sourceHorizontal && targetHorizontal) {
    if (start.y === end.y) routes.push([start, end]);
    for (const x of [
      (start.x + end.x) / 2,
      Math.min(start.x, end.x) - 48,
      Math.max(start.x, end.x) + 48
    ]) {
      routes.push([start, { x, y: start.y }, { x, y: end.y }, end]);
    }
  } else if (!sourceHorizontal && !targetHorizontal) {
    if (start.x === end.x) routes.push([start, end]);
    for (const y of [
      (start.y + end.y) / 2,
      Math.min(start.y, end.y) - 48,
      Math.max(start.y, end.y) + 48
    ]) {
      routes.push([start, { x: start.x, y }, { x: end.x, y }, end]);
    }
  } else if (sourceHorizontal) {
    routes.push([start, { x: end.x, y: start.y }, end]);
  } else {
    routes.push([start, { x: start.x, y: end.y }, end]);
  }

  const startStub = outward(start, sourceSide);
  const endStub = outward(end, targetSide);
  if (sourceHorizontal) {
    routes.push([
      start,
      startStub,
      { x: startStub.x, y: endStub.y },
      endStub,
      end
    ]);
  } else {
    routes.push([
      start,
      startStub,
      { x: endStub.x, y: startStub.y },
      endStub,
      end
    ]);
  }

  return routes.map(dedupe).filter((points) => points.length >= 2 && isOrthogonal(points));
}

function routeHitsEndpointInterior(points, source, target) {
  const segments = segmentsFromPoints(points);
  const sourceInterior = rectOf(source, -3);
  const targetInterior = rectOf(target, -3);
  return segments.some((segment, index) => {
    if (index > 0 && segmentIntersectsRect(segment, sourceInterior)) return true;
    if (index < segments.length - 1 && segmentIntersectsRect(segment, targetInterior)) return true;
    return false;
  });
}

function routeHitsOtherNodes(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  for (const [semanticId, node] of nodes) {
    if (semanticId === edgeMeta.from || semanticId === edgeMeta.to) continue;
    const obstacle = rectOf(node, 3);
    if (segments.some((segment) => segmentIntersectsRect(segment, obstacle))) return true;
  }
  return false;
}

function setEdgePoints(edge, points, sourceSide, targetSide) {
  const first = points[0];
  edge.x = first.x;
  edge.y = first.y;
  edge.points = points.map((point) => [point.x - first.x, point.y - first.y]);
  const last = edge.points.at(-1) ?? [0, 0];
  edge.width = last[0];
  edge.height = last[1];
  const meta = metaOf(edge);
  meta.route = {
    ...(meta.route ?? {}),
    engine: 'patch-route-portfolio-v0.1',
    sourceSide,
    targetSide,
    axisLock: null,
    bends: Math.max(0, points.length - 2)
  };
}

function absolutePoints(edge) {
  return (edge.points ?? []).map(([x, y]) => ({ x: edge.x + x, y: edge.y + y }));
}

function routeShape(edge) {
  const points = absolutePoints(edge);
  return {
    bends: Math.max(0, points.length - 2),
    length: polylineLength(points)
  };
}

function hardDefectCount(report) {
  const metrics = report.metrics ?? {};
  return Number(metrics.nodeOverlaps ?? 0)
    + Number(metrics.edgeNodeCrossings ?? 0)
    + Number(metrics.endpointOverlaps ?? 0)
    + Number(metrics.endpointApproachViolations ?? 0)
    + Number(metrics.endpointNodePenetrations ?? 0)
    + Number(metrics.labelOverlaps ?? 0)
    + Number(metrics.labelNodeOverlaps ?? 0)
    + Number(metrics.textOverflows ?? 0)
    + Number(metrics.edgeVisualMismatches ?? 0)
    + Number(metrics.unresolvedFrameCollisions ?? 0)
    + Math.max(0, Number(metrics.edgeCrossings ?? 0) - 2)
    + (Number(metrics.aspectRatio ?? 0) > 8 ? 1 : 0);
}

function routeOnlyCost(scene) {
  const perceptual = createPerceptualQuality(scene, null);
  return Number(perceptual.metrics.readabilityCost ?? 0)
    - Number(perceptual.metrics.edgeLabelAssociationCost ?? 0);
}

function candidateKey(points, sourceSide, targetSide) {
  return `${sourceSide}:${targetSide}:${points.map((point) => `${point.x},${point.y}`).join(';')}`;
}

function generateCandidates(scene, edge, nodes) {
  const edgeMeta = metaOf(edge);
  const source = nodes.get(edgeMeta.from);
  const target = nodes.get(edgeMeta.to);
  if (!source || !target) return [];
  const sides = ['right', 'down', 'left', 'up'];
  const offsets = [0, -24, 24, -16, 16];
  const seen = new Set();
  const candidates = [];

  for (const sourceSide of sides) {
    for (const targetSide of sides) {
      for (const sourceOffset of offsets) {
        for (const targetOffset of offsets) {
          const start = anchor(source, sourceSide, sourceOffset);
          const end = anchor(target, targetSide, targetOffset);
          for (const points of simpleRoutes(start, end, sourceSide, targetSide)) {
            const key = candidateKey(points, sourceSide, targetSide);
            if (seen.has(key)) continue;
            seen.add(key);
            if (routeHitsEndpointInterior(points, source, target)) continue;
            if (routeHitsOtherNodes(points, edgeMeta, nodes)) continue;
            const shape = {
              bends: Math.max(0, points.length - 2),
              length: polylineLength(points)
            };
            candidates.push({ points, sourceSide, targetSide, ...shape });
          }
        }
      }
    }
  }

  candidates.sort((first, second) => first.bends - second.bends
    || first.length - second.length
    || first.sourceSide.localeCompare(second.sourceSide)
    || first.targetSide.localeCompare(second.targetSide)
    || candidateKey(first.points, first.sourceSide, first.targetSide)
      .localeCompare(candidateKey(second.points, second.sourceSide, second.targetSide)));

  // Keep the portfolio bounded while retaining candidates from every endpoint-side pair.
  const selected = [];
  const perPair = new Map();
  for (const candidate of candidates) {
    const pair = `${candidate.sourceSide}:${candidate.targetSide}`;
    const count = perPair.get(pair) ?? 0;
    if (count >= 5) continue;
    perPair.set(pair, count + 1);
    selected.push(candidate);
  }
  return selected;
}

function copyEdgeGeometry(target, source) {
  for (const key of ['x', 'y', 'width', 'height']) target[key] = source[key];
  target.points = clone(source.points ?? []);
  if (metaOf(source).route) metaOf(target).route = clone(metaOf(source).route);
}

function copyEdgeLabelPlacement(targetScene, scoredScene, edgeId) {
  const target = semanticElements(targetScene, 'edge-label').find((label) => metaOf(label).edge === edgeId);
  const source = semanticElements(scoredScene, 'edge-label').find((label) => metaOf(label).edge === edgeId);
  if (!target || !source) return;
  target.x = source.x;
  target.y = source.y;
  target.backgroundColor = source.backgroundColor;
  if (metaOf(source).placement) metaOf(target).placement = clone(metaOf(source).placement);
}

function scoredCandidate(scene, edgeId, candidate) {
  const next = clone(scene);
  const edge = semanticElements(next, 'edge').find((item) => metaOf(item).semanticId === edgeId);
  if (!edge) return null;
  setEdgePoints(edge, candidate.points, candidate.sourceSide, candidate.targetSide);
  const quality = createQualityReport(next);
  const shape = routeShape(edge);
  return {
    scene: next,
    quality,
    hardDefects: hardDefectCount(quality),
    routeCost: routeOnlyCost(next),
    bends: shape.bends,
    length: shape.length,
    sourceSide: candidate.sourceSide,
    targetSide: candidate.targetSide
  };
}

function baselineScore(scene, edgeId) {
  const edge = semanticElements(scene, 'edge').find((item) => metaOf(item).semanticId === edgeId);
  const quality = createQualityReport(scene);
  const shape = edge ? routeShape(edge) : { bends: 0, length: 0 };
  return {
    scene: clone(scene),
    quality,
    hardDefects: hardDefectCount(quality),
    routeCost: routeOnlyCost(scene),
    bends: shape.bends,
    length: shape.length,
    sourceSide: metaOf(edge).route?.sourceSide ?? null,
    targetSide: metaOf(edge).route?.targetSide ?? null,
    strategy: 'preserve'
  };
}

function compareCandidates(first, second) {
  if (first.hardDefects !== second.hardDefects) return first.hardDefects - second.hardDefects;
  if (first.quality.structuralPass !== second.quality.structuralPass) {
    return first.quality.structuralPass ? -1 : 1;
  }
  if (Math.abs(first.routeCost - second.routeCost) > 0.01) return first.routeCost - second.routeCost;
  if (first.bends !== second.bends) return first.bends - second.bends;
  if (Math.abs(first.length - second.length) > 0.01) return first.length - second.length;
  return String(first.sourceSide).localeCompare(String(second.sourceSide))
    || String(first.targetSide).localeCompare(String(second.targetSide));
}

function scoreLabelPlacement(scene, edgeId) {
  const placed = clone(scene);
  placeEdgeLabels(placed, null);
  copyEdgeLabelPlacement(scene, placed, edgeId);
}

function isFlowScene(scene) {
  const layout = scene?.customData?.excalidrawSkill?.layout;
  return layout?.family === 'flow'
    || ['service-flow', 'event-flow', 'data-flow', 'flow'].includes(layout?.subtype);
}

export function improvePatchRoutes(scene, affectedEdges) {
  if (!isFlowScene(scene)) {
    return {
      version: '0.1.0',
      engine: 'patch-route-portfolio',
      considered: 0,
      changed: 0,
      decisions: []
    };
  }

  const edgeIds = [...affectedEdges].sort();
  const decisions = [];
  let changed = 0;

  for (const edgeId of edgeIds) {
    const edges = bySemanticId(semanticElements(scene, 'edge'));
    const edge = edges.get(edgeId);
    if (!edge) continue;
    const nodes = bySemanticId(semanticElements(scene, 'node'));
    const baseline = baselineScore(scene, edgeId);
    const generated = generateCandidates(scene, edge, nodes);
    const scored = [baseline];

    for (const candidate of generated) {
      const result = scoredCandidate(scene, edgeId, candidate);
      if (result) scored.push({ ...result, strategy: 'generated' });
    }
    scored.sort(compareCandidates);
    const best = scored[0];
    const improvement = baseline.routeCost - best.routeCost;
    const accepted = best.strategy !== 'preserve'
      && best.quality.structuralPass
      && (baseline.quality.structuralPass ? improvement >= 0.5 : best.hardDefects < baseline.hardDefects);

    if (accepted) {
      const target = edges.get(edgeId);
      const source = semanticElements(best.scene, 'edge').find((item) => metaOf(item).semanticId === edgeId);
      if (target && source) {
        copyEdgeGeometry(target, source);
        scoreLabelPlacement(scene, edgeId);
        metaOf(target).patchRoutePortfolio = {
          version: '0.1.0',
          sourceSide: best.sourceSide,
          targetSide: best.targetSide,
          bends: best.bends,
          length: Number(best.length.toFixed(1)),
          routeCostBefore: Number(baseline.routeCost.toFixed(2)),
          routeCostAfter: Number(best.routeCost.toFixed(2))
        };
        changed += 1;
      }
    }

    decisions.push({
      edge: edgeId,
      candidates: scored.length,
      accepted,
      selectedStrategy: accepted ? 'generated' : 'preserve',
      sourceSide: accepted ? best.sourceSide : baseline.sourceSide,
      targetSide: accepted ? best.targetSide : baseline.targetSide,
      bendsBefore: baseline.bends,
      bendsAfter: accepted ? best.bends : baseline.bends,
      lengthBefore: Number(baseline.length.toFixed(1)),
      lengthAfter: Number((accepted ? best.length : baseline.length).toFixed(1)),
      routeCostBefore: Number(baseline.routeCost.toFixed(2)),
      routeCostAfter: Number((accepted ? best.routeCost : baseline.routeCost).toFixed(2)),
      improvement: Number((accepted ? improvement : 0).toFixed(2))
    });
  }

  return {
    version: '0.1.0',
    engine: 'patch-route-portfolio',
    considered: decisions.length,
    changed,
    decisions
  };
}
