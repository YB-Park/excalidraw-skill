import { absolutePoints, polylineLength, segmentsFromEdge, segmentsIntersect } from './geometry.mjs';

function metaOf(element) {
  return element.customData?.excalidrawSkill ?? {};
}

function primaryPairSet(spec) {
  const ids = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let index = 0; index < ids.length - 1; index += 1) {
    pairs.add(`${ids[index]}->${ids[index + 1]}`);
  }
  return pairs;
}

function routeMetrics(edge) {
  const points = absolutePoints(edge);
  if (points.length < 2) {
    return {
      bends: 0,
      routeLength: 0,
      idealOrthogonalLength: 0,
      extraLength: 0,
      detourRatio: 1
    };
  }
  const first = points[0];
  const last = points.at(-1);
  const idealOrthogonalLength = Math.abs(last.x - first.x) + Math.abs(last.y - first.y);
  const routeLength = polylineLength(points);
  const extraLength = Math.max(0, routeLength - idealOrthogonalLength);
  const detourRatio = idealOrthogonalLength > 1
    ? routeLength / idealOrthogonalLength
    : routeLength > 1
      ? 2
      : 1;
  return {
    bends: Math.max(0, points.length - 2),
    routeLength,
    idealOrthogonalLength,
    extraLength,
    detourRatio
  };
}

function acuteCrossingAngle(first, second) {
  const ax = first.b.x - first.a.x;
  const ay = first.b.y - first.a.y;
  const bx = second.b.x - second.a.x;
  const by = second.b.y - second.a.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength < 1e-9 || bLength < 1e-9) return 0;
  const cosine = Math.max(-1, Math.min(1, Math.abs((ax * bx + ay * by) / (aLength * bLength))));
  return Math.acos(cosine) * 180 / Math.PI;
}

function crossingMetrics(edges) {
  const details = [];
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const firstEdge = edges[firstIndex];
      const secondEdge = edges[secondIndex];
      const firstMeta = metaOf(firstEdge);
      const secondMeta = metaOf(secondEdge);
      for (const first of segmentsFromEdge(firstEdge)) {
        for (const second of segmentsFromEdge(secondEdge)) {
          if (!segmentsIntersect(first, second, { includeEndpoints: false })) continue;
          const angle = acuteCrossingAngle(first, second);
          details.push({
            firstEdge: firstMeta.semanticId,
            secondEdge: secondMeta.semanticId,
            angle
          });
        }
      }
    }
  }
  const minAngle = details.length ? Math.min(...details.map((item) => item.angle)) : 90;
  const lowAngle = details.filter((item) => item.angle < 45).length;
  const crossingCost = details.reduce((sum, item) => {
    const shallowPenalty = Math.max(0, 60 - item.angle) / 2.5;
    return sum + 8 + shallowPenalty;
  }, 0);
  return { details, minAngle, lowAngle, crossingCost };
}

function pointToSegmentDistance(point, segment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-9) return Math.hypot(point.x - segment.a.x, point.y - segment.a.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared));
  const x = segment.a.x + projection * dx;
  const y = segment.a.y + projection * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function distanceToEdge(point, edge) {
  const segments = segmentsFromEdge(edge);
  return segments.length ? Math.min(...segments.map((segment) => pointToSegmentDistance(point, segment))) : Number.POSITIVE_INFINITY;
}

function edgeLabelAssociation(edgeLabels, edges) {
  const edgesById = new Map(edges.map((edge) => [metaOf(edge).semanticId, edge]));
  const details = [];
  for (const label of edgeLabels) {
    const edgeId = metaOf(label).edge;
    const ownEdge = edgesById.get(edgeId);
    if (!ownEdge) continue;
    const center = {
      x: Number(label.x ?? 0) + Number(label.width ?? 0) / 2,
      y: Number(label.y ?? 0) + Number(label.height ?? 0) / 2
    };
    const ownDistance = distanceToEdge(center, ownEdge);
    let nearestOtherEdge = null;
    let nearestOtherDistance = Number.POSITIVE_INFINITY;
    for (const edge of edges) {
      if (edge === ownEdge) continue;
      const distance = distanceToEdge(center, edge);
      if (distance < nearestOtherDistance) {
        nearestOtherDistance = distance;
        nearestOtherEdge = metaOf(edge).semanticId;
      }
    }
    const ambiguous = nearestOtherEdge !== null && nearestOtherDistance + 12 < ownDistance;
    const distant = ownDistance > 56;
    details.push({
      edge: edgeId,
      ownDistance,
      nearestOtherEdge,
      nearestOtherDistance,
      ambiguous,
      distant
    });
  }
  const ambiguous = details.filter((item) => item.ambiguous);
  const distant = details.filter((item) => item.distant);
  const averageDistance = details.length
    ? details.reduce((sum, item) => sum + item.ownDistance, 0) / details.length
    : 0;
  const cost = details.reduce((sum, item) => sum
    + (item.ambiguous ? 14 : 0)
    + Math.max(0, item.ownDistance - 36) / 8, 0);
  return { details, ambiguous, distant, averageDistance, cost };
}

function sceneComposition(nodes) {
  if (nodes.length === 0) {
    return {
      density: 0,
      balanceOffset: 0,
      width: 0,
      height: 0
    };
  }
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const totalNodeArea = nodes.reduce((sum, node) => sum + Math.max(0, node.width * node.height), 0);
  const weightedCenter = nodes.reduce((acc, node) => {
    const area = Math.max(1, node.width * node.height);
    acc.x += (node.x + node.width / 2) * area;
    acc.y += (node.y + node.height / 2) * area;
    acc.area += area;
    return acc;
  }, { x: 0, y: 0, area: 0 });
  const centerX = weightedCenter.x / weightedCenter.area;
  const centerY = weightedCenter.y / weightedCenter.area;
  const canvasCenterX = minX + width / 2;
  const canvasCenterY = minY + height / 2;
  const diagonal = Math.hypot(width, height);
  return {
    density: totalNodeArea / (width * height),
    balanceOffset: diagonal > 0
      ? Math.hypot(centerX - canvasCenterX, centerY - canvasCenterY) / diagonal
      : 0,
    width,
    height
  };
}

function rounded(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export function createPerceptualQuality(scene, spec = null) {
  const nodes = [];
  const edges = [];
  const edgeLabels = [];
  for (const element of scene?.elements ?? []) {
    const role = metaOf(element).role;
    if (role === 'node') nodes.push(element);
    if (role === 'edge') edges.push(element);
    if (role === 'edge-label') edgeLabels.push(element);
  }

  const primaryPairs = primaryPairSet(spec);
  const edgeDetails = edges.map((edge) => {
    const meta = metaOf(edge);
    const metrics = routeMetrics(edge);
    const primary = primaryPairs.has(`${meta.from}->${meta.to}`)
      || spec?.edges?.some((candidate) => {
        const candidateId = candidate.semanticId ?? `${candidate.from}_to_${candidate.to}`;
        return candidateId === meta.semanticId && candidate.routeHints?.priority === 'primary';
      });
    const severeDetour = metrics.detourRatio >= 1.65 && metrics.extraLength >= 100;
    const moderateDetour = !severeDetour && metrics.detourRatio >= 1.3 && metrics.extraLength >= 60;
    const highBendComplexity = metrics.bends >= 3;
    return {
      edge: meta.semanticId,
      from: meta.from,
      to: meta.to,
      primary: Boolean(primary),
      bends: metrics.bends,
      routeLength: rounded(metrics.routeLength, 1),
      idealOrthogonalLength: rounded(metrics.idealOrthogonalLength, 1),
      extraLength: rounded(metrics.extraLength, 1),
      detourRatio: rounded(metrics.detourRatio, 2),
      severeDetour,
      moderateDetour,
      highBendComplexity
    };
  });

  const totalBends = edgeDetails.reduce((sum, edge) => sum + edge.bends, 0);
  const primaryEdges = edgeDetails.filter((edge) => edge.primary);
  const primaryBends = primaryEdges.reduce((sum, edge) => sum + edge.bends, 0);
  const severeDetours = edgeDetails.filter((edge) => edge.severeDetour);
  const moderateDetours = edgeDetails.filter((edge) => edge.moderateDetour);
  const highBendEdges = edgeDetails.filter((edge) => edge.highBendComplexity);
  const averageDetourRatio = edgeDetails.length
    ? edgeDetails.reduce((sum, edge) => sum + edge.detourRatio, 0) / edgeDetails.length
    : 1;
  const maxDetourRatio = edgeDetails.length
    ? Math.max(...edgeDetails.map((edge) => edge.detourRatio))
    : 1;
  const primaryAverageDetourRatio = primaryEdges.length
    ? primaryEdges.reduce((sum, edge) => sum + edge.detourRatio, 0) / primaryEdges.length
    : 1;
  const averageBendsPerEdge = edgeDetails.length ? totalBends / edgeDetails.length : 0;
  const crossings = crossingMetrics(edges);
  const labelAssociation = edgeLabelAssociation(edgeLabels, edges);
  const composition = sceneComposition(nodes);

  const edgeCost = edgeDetails.reduce((cost, edge) => {
    const primaryMultiplier = edge.primary ? 1.8 : 1;
    return cost
      + edge.bends * 8 * primaryMultiplier
      + (edge.extraLength / 80) * primaryMultiplier
      + (edge.severeDetour ? 18 * primaryMultiplier : 0)
      + (edge.moderateDetour ? 6 * primaryMultiplier : 0)
      + (edge.highBendComplexity ? 6 * primaryMultiplier : 0);
  }, 0);
  const readabilityCost = edgeCost + crossings.crossingCost + labelAssociation.cost;

  const warnings = [];
  for (const edge of severeDetours) {
    warnings.push({
      kind: 'severe-edge-detour',
      edge: edge.edge,
      detourRatio: edge.detourRatio,
      extraLength: edge.extraLength
    });
  }
  for (const edge of highBendEdges) {
    warnings.push({
      kind: edge.primary ? 'primary-flow-continuity' : 'edge-bend-complexity',
      edge: edge.edge,
      bends: edge.bends,
      routeLength: edge.routeLength
    });
  }
  if (averageBendsPerEdge >= 1.25 && edgeDetails.length >= 5) {
    warnings.push({
      kind: 'scene-bend-complexity',
      averageBendsPerEdge: rounded(averageBendsPerEdge, 2),
      totalBends
    });
  }
  if (crossings.lowAngle > 0) {
    warnings.push({
      kind: 'low-angle-crossings',
      count: crossings.lowAngle,
      minAngle: rounded(crossings.minAngle, 1)
    });
  }
  for (const item of labelAssociation.ambiguous) {
    warnings.push({
      kind: 'ambiguous-edge-label-association',
      edge: item.edge,
      ownDistance: rounded(item.ownDistance, 1),
      nearerEdge: item.nearestOtherEdge,
      nearerDistance: rounded(item.nearestOtherDistance, 1)
    });
  }
  for (const item of labelAssociation.distant.filter((candidate) => !candidate.ambiguous)) {
    warnings.push({
      kind: 'distant-edge-label',
      edge: item.edge,
      ownDistance: rounded(item.ownDistance, 1)
    });
  }
  if (composition.balanceOffset > 0.18 && nodes.length >= 5) {
    warnings.push({
      kind: 'composition-imbalance',
      balanceOffset: rounded(composition.balanceOffset, 3)
    });
  }
  if (composition.density < 0.035 && nodes.length >= 5) {
    warnings.push({
      kind: 'composition-too-sparse',
      density: rounded(composition.density, 3)
    });
  }

  const suggestedPatches = [];
  for (const edge of severeDetours) {
    suggestedPatches.push({
      operation: 'shorten-edge-route',
      edge: edge.edge,
      targetDetourRatio: 1.3
    });
  }
  for (const edge of highBendEdges) {
    suggestedPatches.push({
      operation: edge.primary ? 'straighten-primary-flow' : 'reduce-edge-bends',
      edge: edge.edge,
      maxBends: 2
    });
  }
  for (const item of [...labelAssociation.ambiguous, ...labelAssociation.distant]) {
    suggestedPatches.push({
      operation: 'reassociate-edge-label',
      edge: item.edge,
      targetDistance: 36
    });
  }

  return {
    version: '0.4.0',
    mode: 'advisory',
    metrics: {
      readabilityCost: rounded(readabilityCost, 2),
      totalBends,
      averageBendsPerEdge: rounded(averageBendsPerEdge, 2),
      highBendEdges: highBendEdges.length,
      edgeCrossings: crossings.details.length,
      minCrossingAngle: rounded(crossings.minAngle, 1),
      lowAngleCrossings: crossings.lowAngle,
      crossingCost: rounded(crossings.crossingCost, 2),
      edgeLabelCount: labelAssociation.details.length,
      ambiguousEdgeLabels: labelAssociation.ambiguous.length,
      distantEdgeLabels: labelAssociation.distant.length,
      averageEdgeLabelDistance: rounded(labelAssociation.averageDistance, 1),
      edgeLabelAssociationCost: rounded(labelAssociation.cost, 2),
      primaryFlowBends: primaryBends,
      primaryFlowAverageBends: primaryEdges.length ? rounded(primaryBends / primaryEdges.length, 2) : 0,
      averageDetourRatio: rounded(averageDetourRatio, 2),
      maxDetourRatio: rounded(maxDetourRatio, 2),
      primaryFlowAverageDetourRatio: rounded(primaryAverageDetourRatio, 2),
      severeDetours: severeDetours.length,
      moderateDetours: moderateDetours.length,
      compositionDensity: rounded(composition.density, 3),
      compositionBalanceOffset: rounded(composition.balanceOffset, 3)
    },
    details: {
      edges: edgeDetails,
      crossings: crossings.details.map((item) => ({ ...item, angle: rounded(item.angle, 1) })),
      edgeLabels: labelAssociation.details.map((item) => ({
        ...item,
        ownDistance: rounded(item.ownDistance, 1),
        nearestOtherDistance: Number.isFinite(item.nearestOtherDistance) ? rounded(item.nearestOtherDistance, 1) : null
      })),
      composition: {
        width: rounded(composition.width, 1),
        height: rounded(composition.height, 1)
      },
      warnings
    },
    suggestedPatches
  };
}
