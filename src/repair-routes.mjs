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

function nodeSideAtPoint(node, point) {
  const epsilon = 1e-6;
  if (Math.abs(point.y - node.y) < epsilon) return 'up';
  if (Math.abs(point.y - (node.y + node.height)) < epsilon) return 'down';
  if (Math.abs(point.x - node.x) < epsilon) return 'left';
  if (Math.abs(point.x - (node.x + node.width)) < epsilon) return 'right';
  return null;
}

function endpointSegment(edge, sharedNode) {
  const segments = segmentsFromEdge(edge);
  const meta = metaOf(edge);
  if (meta.from === sharedNode) return segments[0] ?? null;
  if (meta.to === sharedNode) return segments.at(-1) ?? null;
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function moveEndpointOnBoundary(edge, node, sharedNode, offset) {
  const points = absolutePoints(edge);
  const meta = metaOf(edge);
  const atStart = meta.from === sharedNode;
  const endpointIndex = atStart ? 0 : points.length - 1;
  const adjacentIndex = atStart ? 1 : points.length - 2;
  if (adjacentIndex < 0 || adjacentIndex >= points.length) return null;

  const endpoint = { ...points[endpointIndex] };
  const adjacent = { ...points[adjacentIndex] };
  const side = nodeSideAtPoint(node, endpoint);
  if (!side) return null;

  if (side === 'left' || side === 'right') {
    const y = clamp(endpoint.y + offset, node.y + 12, node.y + node.height - 12);
    if (Math.abs(y - endpoint.y) < 1e-9) return null;
    endpoint.y = y;
    adjacent.y = y;
  } else {
    const x = clamp(endpoint.x + offset, node.x + 12, node.x + node.width - 12);
    if (Math.abs(x - endpoint.x) < 1e-9) return null;
    endpoint.x = x;
    adjacent.x = x;
  }

  const next = points.map((point) => ({ ...point }));
  next[endpointIndex] = endpoint;
  next[adjacentIndex] = adjacent;
  return next;
}

function edgeHitsNodes(points, edgeMeta, nodes, padding = 3) {
  const segments = segmentsFromPoints(points);
  let hits = 0;
  for (const [id, node] of nodes) {
    if (id === edgeMeta.from || id === edgeMeta.to) continue;
    if (segments.some((segment) => segmentIntersectsRect(segment, rectOf(node, padding)))) hits += 1;
  }
  return hits;
}

function endpointOverlap(points, edgeMeta, other, sharedNode) {
  const clone = {
    x: points[0].x,
    y: points[0].y,
    points: points.map((point) => [point.x - points[0].x, point.y - points[0].y]),
    customData: { excalidrawSkill: edgeMeta }
  };
  const first = endpointSegment(clone, sharedNode);
  const second = endpointSegment(other, sharedNode);
  return first && second ? collinearOverlapLength(first, second) : 0;
}

function repairEndpointOverlaps(edges, nodes) {
  let repaired = 0;
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const first = edges[firstIndex];
      const second = edges[secondIndex];
      const firstMeta = metaOf(first);
      const secondMeta = metaOf(second);
      const sharedNodes = [firstMeta.from, firstMeta.to]
        .filter((id) => id === secondMeta.from || id === secondMeta.to);

      for (const sharedNode of sharedNodes) {
        const firstSegment = endpointSegment(first, sharedNode);
        const secondSegment = endpointSegment(second, sharedNode);
        if (!firstSegment || !secondSegment || collinearOverlapLength(firstSegment, secondSegment) <= 8) continue;
        const node = nodes.get(sharedNode);
        if (!node) continue;

        const preferred = [16, -16, 32, -32];
        let chosen = null;
        for (const offset of preferred) {
          const candidate = moveEndpointOnBoundary(second, node, sharedNode, offset);
          if (!candidate) continue;
          if (endpointOverlap(candidate, secondMeta, first, sharedNode) > 8) continue;
          if (edgeHitsNodes(candidate, secondMeta, nodes) > 0) continue;
          chosen = candidate;
          break;
        }
        if (!chosen) continue;
        setEdgePoints(second, chosen);
        const meta = metaOf(second);
        meta.routeRepair ??= {};
        meta.routeRepair.endpointSeparated = true;
        repaired += 1;
      }
    }
  }
  return repaired;
}

function outward(point, side, distance) {
  if (side === 'up') return { x: point.x, y: point.y - distance };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function sceneBounds(nodes) {
  const list = [...nodes.values()];
  return {
    left: Math.min(...list.map((node) => node.x)),
    right: Math.max(...list.map((node) => node.x + node.width)),
    top: Math.min(...list.map((node) => node.y)),
    bottom: Math.max(...list.map((node) => node.y + node.height))
  };
}

function routeCandidatesAroundBlocker(edge, blocker, nodes) {
  const points = absolutePoints(edge);
  if (points.length < 2) return [];
  const start = points[0];
  const end = points.at(-1);
  const route = metaOf(edge).route ?? {};
  const sourceSide = route.sourceSide ?? null;
  const targetSide = route.targetSide ?? null;
  if (!sourceSide || !targetSide) return [];

  // Keep the endpoint stub shorter than the renderer's 34px same-rank slot gap.
  // This prevents a branch below a sibling from entering that sibling before it can detour.
  const stub = 20;
  const startStub = outward(start, sourceSide, stub);
  const endStub = outward(end, targetSide, stub);
  const bounds = sceneBounds(nodes);
  const margin = 36;
  const candidates = [];

  const sourceVertical = sourceSide === 'up' || sourceSide === 'down';
  const targetVertical = targetSide === 'up' || targetSide === 'down';
  if (sourceVertical && targetVertical) {
    for (const bypassX of [
      blocker.x - margin,
      blocker.x + blocker.width + margin,
      bounds.left - 60,
      bounds.right + 60
    ]) {
      candidates.push([
        start,
        startStub,
        { x: bypassX, y: startStub.y },
        { x: bypassX, y: endStub.y },
        endStub,
        end
      ]);
    }
  } else if (!sourceVertical && !targetVertical) {
    for (const bypassY of [
      blocker.y - margin,
      blocker.y + blocker.height + margin,
      bounds.top - 60,
      bounds.bottom + 60
    ]) {
      candidates.push([
        start,
        startStub,
        { x: startStub.x, y: bypassY },
        { x: endStub.x, y: bypassY },
        endStub,
        end
      ]);
    }
  } else {
    const left = blocker.x - margin;
    const right = blocker.x + blocker.width + margin;
    const top = blocker.y - margin;
    const bottom = blocker.y + blocker.height + margin;
    for (const corner of [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom }
    ]) {
      candidates.push([
        start,
        startStub,
        { x: corner.x, y: startStub.y },
        corner,
        { x: endStub.x, y: corner.y },
        endStub,
        end
      ]);
    }
  }

  return candidates.map((candidate) => candidate.filter((point, index, all) => {
    return index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y;
  }));
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

function repairNodeCrossings(edges, nodes) {
  let repaired = 0;
  for (const edge of edges) {
    const edgeMeta = metaOf(edge);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const blockerEntry = [...nodes.entries()].find(([id, node]) => {
        if (id === edgeMeta.from || id === edgeMeta.to) return false;
        return segmentsFromEdge(edge).some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)));
      });
      if (!blockerEntry) break;
      const [, blocker] = blockerEntry;

      const candidates = routeCandidatesAroundBlocker(edge, blocker, nodes)
        .map((points) => ({
          points,
          hits: edgeHitsNodes(points, edgeMeta, nodes),
          crossings: crossingCount(points, edge, edges),
          length: polylineLength(points)
        }))
        .sort((a, b) => a.hits - b.hits || a.crossings - b.crossings || a.length - b.length);
      const chosen = candidates.find((candidate) => candidate.hits === 0);
      if (!chosen) break;

      setEdgePoints(edge, chosen.points);
      edgeMeta.routeRepair ??= {};
      edgeMeta.routeRepair.nodeCrossingRepaired = true;
      repaired += 1;
    }
  }
  return repaired;
}

export function repairRoutes(scene) {
  const nodes = new Map();
  const edges = [];
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }
  if (nodes.size === 0 || edges.length === 0) return scene;

  const nodeCrossingsRepaired = repairNodeCrossings(edges, nodes);
  const endpointOverlapsRepaired = repairEndpointOverlaps(edges, nodes);
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.routeRepair = {
    engine: 'route-repair-v0.1',
    nodeCrossingsRepaired,
    endpointOverlapsRepaired
  };
  return scene;
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/repair-routes.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  writeJson(outputPath, repairRoutes(readJson(scenePath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
