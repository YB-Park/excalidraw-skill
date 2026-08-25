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

function dedupe(points) {
  return points.filter((point, index) => {
    return index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y;
  });
}

function outward(point, side, distance) {
  if (side === 'up') return { x: point.x, y: point.y - distance };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function localCandidates(edge) {
  const points = absolutePoints(edge);
  if (points.length < 3) return [];
  const meta = metaOf(edge);
  const route = meta.route ?? {};
  if (route.axisLock) return [];
  const sourceSide = route.sourceSide;
  const targetSide = route.targetSide;
  if (!sourceSide || !targetSide) return [];

  const start = points[0];
  const end = points.at(-1);
  const stubDistance = 20;
  const startStub = outward(start, sourceSide, stubDistance);
  const endStub = outward(end, targetSide, stubDistance);
  const sourceVertical = sourceSide === 'up' || sourceSide === 'down';
  const targetVertical = targetSide === 'up' || targetSide === 'down';
  const result = [];

  if (sourceVertical && targetVertical) {
    if (Math.abs(start.x - end.x) < 1e-9) result.push([start, end]);
    const middleY = (start.y + end.y) / 2;
    result.push([start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end]);
    result.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
    result.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  } else if (!sourceVertical && !targetVertical) {
    if (Math.abs(start.y - end.y) < 1e-9) result.push([start, end]);
    const middleX = (start.x + end.x) / 2;
    result.push([start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end]);
    result.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
    result.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
  } else {
    result.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
    result.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  }

  return result.map(dedupe).filter((candidate) => candidate.length >= 2);
}

function edgeNodeHits(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  let hits = 0;
  for (const [id, node] of nodes) {
    if (id === edgeMeta.from || id === edgeMeta.to) continue;
    if (segments.some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) hits += 1;
  }
  return hits;
}

function endpointNodePenetrations(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  if (segments.length === 0) return 0;
  let penetrations = 0;
  const source = nodes.get(edgeMeta.from);
  const target = nodes.get(edgeMeta.to);
  const first = segments[0];
  const last = segments.at(-1);
  if (source && segmentIntersectsRect(first, rectOf(source, -3), { includeBoundary: false })) penetrations += 1;
  if (target && segmentIntersectsRect(last, rectOf(target, -3), { includeBoundary: false })) penetrations += 1;
  return penetrations;
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

function endpointSegmentFromPoints(points, edgeMeta, nodeId) {
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
    const sharedNodes = [edgeMeta.from, edgeMeta.to]
      .filter((id) => id === otherMeta.from || id === otherMeta.to);
    for (const nodeId of sharedNodes) {
      const first = endpointSegmentFromPoints(points, edgeMeta, nodeId);
      const otherSegments = segmentsFromEdge(other);
      const second = otherMeta.from === nodeId ? otherSegments[0] : otherSegments.at(-1);
      if (first && second && collinearOverlapLength(first, second) > 8) overlaps += 1;
    }
  }
  return overlaps;
}

function score(points, edge, nodes, edges) {
  const edgeMeta = metaOf(edge);
  return {
    nodeHits: edgeNodeHits(points, edgeMeta, nodes),
    endpointNodePenetrations: endpointNodePenetrations(points, edgeMeta, nodes),
    endpointOverlaps: endpointOverlapCount(points, edge, edges),
    crossings: crossingCount(points, edge, edges),
    bends: Math.max(0, points.length - 2),
    length: polylineLength(points)
  };
}

function shouldReplace(current, candidate) {
  if (candidate.nodeHits > current.nodeHits) return false;
  if (candidate.endpointNodePenetrations > current.endpointNodePenetrations) return false;
  if (candidate.endpointOverlaps > current.endpointOverlaps) return false;
  if (candidate.crossings > current.crossings) return false;
  if (candidate.nodeHits < current.nodeHits) return true;
  if (candidate.endpointNodePenetrations < current.endpointNodePenetrations) return true;
  if (candidate.endpointOverlaps < current.endpointOverlaps) return true;
  if (candidate.crossings < current.crossings) return true;
  if (candidate.bends < current.bends && candidate.length <= current.length + 40) return true;
  return candidate.length + 80 < current.length;
}

export function simplifyRoutes(scene) {
  const nodes = new Map();
  const edges = [];
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }
  if (nodes.size === 0 || edges.length === 0) return scene;

  let simplified = 0;
  for (const edge of edges) {
    const currentPoints = absolutePoints(edge);
    const currentScore = score(currentPoints, edge, nodes, edges);
    const candidates = localCandidates(edge)
      .map((points) => ({ points, score: score(points, edge, nodes, edges) }))
      .filter((candidate) => candidate.score.nodeHits === 0
        && candidate.score.endpointNodePenetrations === 0
        && candidate.score.endpointOverlaps === 0)
      .sort((a, b) => {
        return a.score.crossings - b.score.crossings
          || a.score.bends - b.score.bends
          || a.score.length - b.score.length;
      });
    const chosen = candidates.find((candidate) => shouldReplace(currentScore, candidate.score));
    if (!chosen) continue;
    setEdgePoints(edge, chosen.points);
    const meta = metaOf(edge);
    meta.routeSimplification = {
      previousLength: Number(currentScore.length.toFixed(1)),
      length: Number(chosen.score.length.toFixed(1)),
      previousBends: currentScore.bends,
      bends: chosen.score.bends,
      endpointNodePenetrations: chosen.score.endpointNodePenetrations
    };
    simplified += 1;
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.routeSimplification = {
    engine: 'route-simplify-v0.2',
    simplified
  };
  return scene;
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/simplify-routes.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  writeJson(outputPath, simplifyRoutes(readJson(scenePath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
