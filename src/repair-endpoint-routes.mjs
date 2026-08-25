#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  absolutePoints,
  collinearOverlapLength,
  polylineLength,
  rectOf,
  segmentIntersectsRect,
  segmentsFromEdge,
  segmentsFromPoints,
  segmentsIntersect
} from './geometry.mjs';
import { endpointNodePenetrationsForEdge, segmentPenetratesNodeInterior } from './route-integrity.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function setEdgePoints(edge, points) {
  const first = points[0];
  edge.x = first.x;
  edge.y = first.y;
  edge.points = points.map((point) => [point.x - first.x, point.y - first.y]);
  const last = edge.points.at(-1) ?? [0, 0];
  edge.width = last[0];
  edge.height = last[1];
}

function center(node) {
  return {
    x: Number(node?.x ?? 0) + Number(node?.width ?? 0) / 2,
    y: Number(node?.y ?? 0) + Number(node?.height ?? 0) / 2
  };
}

function sideAt(node, point) {
  const epsilon = 1e-4;
  if (Math.abs(point.y - node.y) < epsilon) return 'up';
  if (Math.abs(point.y - (node.y + node.height)) < epsilon) return 'down';
  if (Math.abs(point.x - node.x) < epsilon) return 'left';
  if (Math.abs(point.x - (node.x + node.width)) < epsilon) return 'right';
  return null;
}

function sideFacing(node, other) {
  const from = center(node);
  const to = center(other);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

function pointOnSide(node, side, fraction) {
  if (side === 'up') return { x: node.x + node.width * fraction, y: node.y };
  if (side === 'down') return { x: node.x + node.width * fraction, y: node.y + node.height };
  if (side === 'left') return { x: node.x, y: node.y + node.height * fraction };
  return { x: node.x + node.width, y: node.y + node.height * fraction };
}

function outward(point, side, distance = 24) {
  if (side === 'up') return { x: point.x, y: point.y - distance };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function compact(points) {
  const deduped = points.filter((point, index) => {
    return index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y;
  });
  const result = [];
  for (const point of deduped) {
    if (result.length < 2) {
      result.push(point);
      continue;
    }
    const a = result[result.length - 2];
    const b = result[result.length - 1];
    const collinear = (a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y);
    if (collinear) result[result.length - 1] = point;
    else result.push(point);
  }
  return result;
}

function routeCandidates(start, end, sourceSide, targetSide) {
  const startStub = outward(start, sourceSide);
  const endStub = outward(end, targetSide);
  const sourceVertical = sourceSide === 'up' || sourceSide === 'down';
  const targetVertical = targetSide === 'up' || targetSide === 'down';
  const candidates = [];

  if (sourceVertical && targetVertical) {
    const midY = (startStub.y + endStub.y) / 2;
    candidates.push([start, startStub, { x: startStub.x, y: midY }, { x: endStub.x, y: midY }, endStub, end]);
    candidates.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  } else if (!sourceVertical && !targetVertical) {
    const midX = (startStub.x + endStub.x) / 2;
    candidates.push([start, startStub, { x: midX, y: startStub.y }, { x: midX, y: endStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
  } else {
    candidates.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  }

  return candidates.map(compact).filter((points) => points.length >= 2);
}

function endpointOptions(node, otherNode, currentPoint, currentSide, penetrated) {
  if (!penetrated && currentSide) return [{ point: currentPoint, side: currentSide, portPenalty: 0 }];
  const natural = sideFacing(node, otherNode);
  const sides = [natural, currentSide, 'up', 'down', 'left', 'right'].filter(Boolean);
  const uniqueSides = [...new Set(sides)];
  const fractions = [0.5, 0.25, 0.75];
  const result = [];
  for (const side of uniqueSides) {
    for (const fraction of fractions) {
      result.push({
        point: pointOnSide(node, side, fraction),
        side,
        portPenalty: (side === natural ? 0 : 30) + (side === currentSide ? 0 : 8) + Math.abs(fraction - 0.5) * 12
      });
    }
  }
  return result;
}

function unrelatedNodeHits(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  let hits = 0;
  for (const [id, node] of nodes) {
    if (id === edgeMeta.from || id === edgeMeta.to) continue;
    if (segments.some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) hits += 1;
  }
  return hits;
}

function endpointPenetrationCount(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  let count = 0;
  for (const nodeId of [edgeMeta.from, edgeMeta.to]) {
    const node = nodes.get(nodeId);
    if (node && segments.some((segment) => segmentPenetratesNodeInterior(segment, node))) count += 1;
  }
  return count;
}

function crossingCount(points, edge, edges) {
  const segments = segmentsFromPoints(points);
  let crossings = 0;
  for (const other of edges) {
    if (other === edge) continue;
    for (const first of segments) {
      for (const second of segmentsFromEdge(other)) {
        if (segmentsIntersect(first, second, { includeEndpoints: false })) crossings += 1;
      }
    }
  }
  return crossings;
}

function endpointSegment(points, edgeMeta, nodeId) {
  const segments = segmentsFromPoints(points);
  if (edgeMeta.from === nodeId) return segments[0] ?? null;
  if (edgeMeta.to === nodeId) return segments.at(-1) ?? null;
  return null;
}

function endpointOverlapCount(points, edge, edges) {
  const edgeMeta = metaOf(edge);
  let overlaps = 0;
  for (const other of edges) {
    if (other === edge) continue;
    const otherMeta = metaOf(other);
    const shared = [edgeMeta.from, edgeMeta.to].filter((id) => id === otherMeta.from || id === otherMeta.to);
    for (const nodeId of shared) {
      const first = endpointSegment(points, edgeMeta, nodeId);
      const otherSegments = segmentsFromEdge(other);
      const second = otherMeta.from === nodeId ? otherSegments[0] : otherSegments.at(-1);
      if (first && second && collinearOverlapLength(first, second) > 8) overlaps += 1;
    }
  }
  return overlaps;
}

function scoreCandidate(points, edge, nodes, edges, portPenalty) {
  const edgeMeta = metaOf(edge);
  const endpointPenetrations = endpointPenetrationCount(points, edgeMeta, nodes);
  const nodeHits = unrelatedNodeHits(points, edgeMeta, nodes);
  const endpointOverlaps = endpointOverlapCount(points, edge, edges);
  const crossings = crossingCount(points, edge, edges);
  const bends = Math.max(0, points.length - 2);
  const length = polylineLength(points);
  return {
    endpointPenetrations,
    nodeHits,
    endpointOverlaps,
    crossings,
    bends,
    length,
    cost: endpointPenetrations * 1_000_000_000
      + nodeHits * 100_000_000
      + endpointOverlaps * 1_000_000
      + crossings * 10_000
      + bends * 100
      + length
      + portPenalty
  };
}

function repairEdge(edge, nodes, edges) {
  const edgeMeta = metaOf(edge);
  const source = nodes.get(edgeMeta.from);
  const target = nodes.get(edgeMeta.to);
  if (!source || !target) return null;
  const violations = endpointNodePenetrationsForEdge(edge, nodes);
  if (violations.length === 0) return null;

  const penetratedSource = violations.some((item) => item.endpoint === 'source');
  const penetratedTarget = violations.some((item) => item.endpoint === 'target');
  const current = absolutePoints(edge);
  const start = current[0];
  const end = current.at(-1);
  const currentSourceSide = sideAt(source, start) ?? edgeMeta.route?.sourceSide ?? null;
  const currentTargetSide = sideAt(target, end) ?? edgeMeta.route?.targetSide ?? null;
  const sourceOptions = endpointOptions(source, target, start, currentSourceSide, penetratedSource);
  const targetOptions = endpointOptions(target, source, end, currentTargetSide, penetratedTarget);
  const currentCrossings = crossingCount(current, edge, edges);
  const candidates = [];

  for (const sourceOption of sourceOptions) {
    for (const targetOption of targetOptions) {
      for (const points of routeCandidates(sourceOption.point, targetOption.point, sourceOption.side, targetOption.side)) {
        const score = scoreCandidate(points, edge, nodes, edges, sourceOption.portPenalty + targetOption.portPenalty);
        if (score.endpointPenetrations > 0 || score.nodeHits > 0 || score.endpointOverlaps > 0) continue;
        if (score.crossings > currentCrossings + 1) continue;
        candidates.push({ points, score, sourceSide: sourceOption.side, targetSide: targetOption.side });
      }
    }
  }

  candidates.sort((a, b) => a.score.cost - b.score.cost);
  const chosen = candidates[0];
  if (!chosen) return { repaired: false, violations };

  setEdgePoints(edge, chosen.points);
  edgeMeta.route ??= {};
  edgeMeta.route.sourceSide = chosen.sourceSide;
  edgeMeta.route.targetSide = chosen.targetSide;
  edgeMeta.endpointIntegrityRepair = {
    engine: 'endpoint-integrity-v0.1',
    previousViolations: violations,
    sourceSide: chosen.sourceSide,
    targetSide: chosen.targetSide,
    crossings: chosen.score.crossings,
    bends: chosen.score.bends,
    length: Number(chosen.score.length.toFixed(1))
  };
  return { repaired: true, violations, score: chosen.score };
}

export function repairEndpointRoutes(scene) {
  const nodes = new Map();
  const edges = [];
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && typeof meta.semanticId === 'string') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }
  if (nodes.size === 0 || edges.length === 0) return scene;

  const decisions = [];
  let repaired = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = 0;
    for (const edge of edges) {
      const result = repairEdge(edge, nodes, edges);
      if (!result) continue;
      decisions.push({ edge: metaOf(edge).semanticId, pass, ...result });
      if (result.repaired) {
        repaired += 1;
        changed += 1;
      }
    }
    if (changed === 0) break;
  }

  const unresolved = edges.flatMap((edge) => endpointNodePenetrationsForEdge(edge, nodes));
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.endpointIntegrityRepair = {
    version: '0.1.0',
    repaired,
    unresolved: unresolved.length,
    decisions
  };
  return scene;
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/repair-endpoint-routes.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  const result = repairEndpointRoutes(readJson(scenePath));
  writeJson(outputPath, result);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    repair: result.customData?.excalidrawSkill?.endpointIntegrityRepair ?? null
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`repair-endpoint-routes failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
