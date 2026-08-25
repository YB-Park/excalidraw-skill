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
import { segmentPenetratesNodeInterior } from './route-integrity.mjs';

const MODULE_ROUTE_PADDING = 40;
const STUB = 20;

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

function clonePoint(point) {
  return { x: point.x, y: point.y };
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
  const filtered = points.filter((point, index) => index === 0
    || point.x !== points[index - 1].x
    || point.y !== points[index - 1].y);
  const result = [];
  for (const point of filtered) {
    if (result.length < 2) {
      result.push(point);
      continue;
    }
    const a = result[result.length - 2];
    const b = result[result.length - 1];
    const collinear = (a.x === b.x && b.x === point.x)
      || (a.y === b.y && b.y === point.y);
    if (collinear) result[result.length - 1] = point;
    else result.push(point);
  }
  return result;
}

function outward(point, side, distance = STUB) {
  if (side === 'up') return { x: point.x, y: point.y - distance };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function center(node) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function pointOnSide(node, side, fraction = 0.5) {
  if (side === 'up') return { x: node.x + node.width * fraction, y: node.y };
  if (side === 'down') return { x: node.x + node.width * fraction, y: node.y + node.height };
  if (side === 'left') return { x: node.x, y: node.y + node.height * fraction };
  return { x: node.x + node.width, y: node.y + node.height * fraction };
}

function moduleMemberIds(spec) {
  if (spec?.diagramType !== 'module-architecture' || spec?.layout?.profile !== 'component-view') return new Set();
  const focusModule = spec.module?.focusModule;
  if (!focusModule) return new Set();
  return new Set((spec.nodes ?? [])
    .filter((node) => node.group === focusModule)
    .map((node) => node.semanticId));
}

function moduleBounds(nodes, memberIds) {
  const members = [...memberIds].map((id) => nodes.get(id)).filter(Boolean);
  if (members.length === 0) return null;
  return {
    left: Math.min(...members.map((node) => node.x)) - MODULE_ROUTE_PADDING,
    right: Math.max(...members.map((node) => node.x + node.width)) + MODULE_ROUTE_PADDING,
    top: Math.min(...members.map((node) => node.y)) - MODULE_ROUTE_PADDING,
    bottom: Math.max(...members.map((node) => node.y + node.height)) + MODULE_ROUTE_PADDING
  };
}

function pointInside(point, bounds) {
  return point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom;
}

function routeEscapes(points, bounds) {
  return points.some((point) => !pointInside(point, bounds));
}

function endpointNodePenetrations(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  if (segments.length === 0) return 0;
  let count = 0;
  for (const nodeId of [edgeMeta.from, edgeMeta.to]) {
    const node = nodes.get(nodeId);
    if (node && segments.some((segment) => segmentPenetratesNodeInterior(segment, node))) count += 1;
  }
  return count;
}

function nodeHits(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  let count = 0;
  for (const [id, node] of nodes) {
    if (id === edgeMeta.from || id === edgeMeta.to) continue;
    if (segments.some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) count += 1;
  }
  return count;
}

function crossingCount(points, edge, edges) {
  const segments = segmentsFromPoints(points);
  let count = 0;
  for (const other of edges) {
    if (other === edge) continue;
    for (const first of segments) {
      for (const second of segmentsFromEdge(other)) {
        if (segmentsIntersect(first, second, { includeEndpoints: false })) count += 1;
      }
    }
  }
  return count;
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

function routeCandidates(edge, bounds) {
  const points = absolutePoints(edge);
  if (points.length < 2) return [];
  const meta = metaOf(edge);
  const route = meta.route ?? {};
  const sourceSide = route.sourceSide;
  const targetSide = route.targetSide;
  if (!sourceSide || !targetSide) return [];
  const start = points[0];
  const end = points.at(-1);
  const startStub = outward(start, sourceSide);
  const endStub = outward(end, targetSide);
  const sourceVertical = sourceSide === 'up' || sourceSide === 'down';
  const targetVertical = targetSide === 'up' || targetSide === 'down';
  const candidates = [];

  if (sourceVertical && targetVertical) {
    for (const x of [
      bounds.left + STUB,
      bounds.right - STUB,
      (startStub.x + endStub.x) / 2
    ]) {
      candidates.push([start, startStub, { x, y: startStub.y }, { x, y: endStub.y }, endStub, end]);
    }
  } else if (!sourceVertical && !targetVertical) {
    for (const y of [
      bounds.top + STUB,
      bounds.bottom - STUB,
      (startStub.y + endStub.y) / 2
    ]) {
      candidates.push([start, startStub, { x: startStub.x, y }, { x: endStub.x, y }, endStub, end]);
    }
  } else {
    candidates.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  }

  return candidates.map((candidate) => dedupe(candidate.map(clonePoint)));
}

function routeScore(points, edge, nodes, edges) {
  return {
    endpointNodePenetrations: endpointNodePenetrations(points, metaOf(edge), nodes),
    nodeHits: nodeHits(points, metaOf(edge), nodes),
    endpointOverlaps: endpointOverlapCount(points, edge, edges),
    crossings: crossingCount(points, edge, edges),
    bends: Math.max(0, points.length - 2),
    length: polylineLength(points)
  };
}

function hubFraction(hub, satellite) {
  const hubCenter = center(hub);
  const satelliteCenter = center(satellite);
  if (satelliteCenter.y < hubCenter.y - 1) return 0.25;
  if (satelliteCenter.y > hubCenter.y + 1) return 0.75;
  return 0.5;
}

function hubSpokeCandidate(edge, nodes, layout) {
  if (layout?.strategy !== 'hub-grid' || !layout?.hubId) return null;
  const edgeMeta = metaOf(edge);
  const hub = nodes.get(layout.hubId);
  if (!hub) return null;
  const hubIsSource = edgeMeta.from === layout.hubId;
  const hubIsTarget = edgeMeta.to === layout.hubId;
  if (!hubIsSource && !hubIsTarget) return null;
  const satelliteId = hubIsSource ? edgeMeta.to : edgeMeta.from;
  const satellite = nodes.get(satelliteId);
  if (!satellite) return null;

  const hubCenter = center(hub);
  const satelliteCenter = center(satellite);
  if (Math.abs(satelliteCenter.x - hubCenter.x) < Math.max(hub.width, satellite.width) * 0.4) return null;
  if (Math.abs(satelliteCenter.y - hubCenter.y) < 1) return null;

  const satelliteIsRight = satelliteCenter.x > hubCenter.x;
  const hubSide = satelliteIsRight ? 'right' : 'left';
  const satelliteSide = satelliteIsRight ? 'left' : 'right';
  const fraction = hubFraction(hub, satellite);

  const sourceNode = nodes.get(edgeMeta.from);
  const targetNode = nodes.get(edgeMeta.to);
  const sourceSide = hubIsSource ? hubSide : satelliteSide;
  const targetSide = hubIsTarget ? hubSide : satelliteSide;
  const sourceFraction = hubIsSource ? fraction : 0.5;
  const targetFraction = hubIsTarget ? fraction : 0.5;
  const start = pointOnSide(sourceNode, sourceSide, sourceFraction);
  const end = pointOnSide(targetNode, targetSide, targetFraction);
  const midX = (start.x + end.x) / 2;
  const points = dedupe([
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end
  ]);
  return { points, sourceSide, targetSide, hubId: layout.hubId, satelliteId, hubPortFraction: fraction };
}

function repairHubSpokes(scene, nodes, edges, memberIds, bounds) {
  const layout = scene.customData?.excalidrawSkill?.layout;
  if (layout?.strategy !== 'hub-grid' || !layout?.hubId) {
    return { considered: 0, repaired: 0, decisions: [] };
  }

  let considered = 0;
  let repaired = 0;
  const decisions = [];
  for (const edge of edges) {
    const edgeMeta = metaOf(edge);
    if (!memberIds.has(edgeMeta.from) || !memberIds.has(edgeMeta.to)) continue;
    const proposal = hubSpokeCandidate(edge, nodes, layout);
    if (!proposal) continue;
    const current = absolutePoints(edge);
    const currentScore = routeScore(current, edge, nodes, edges);
    if (currentScore.bends <= 2) continue;
    considered += 1;
    const nextScore = routeScore(proposal.points, edge, nodes, edges);
    const safe = !routeEscapes(proposal.points, bounds)
      && nextScore.endpointNodePenetrations === 0
      && nextScore.nodeHits === 0
      && nextScore.endpointOverlaps === 0
      && nextScore.crossings <= currentScore.crossings
      && nextScore.bends < currentScore.bends
      && nextScore.length <= currentScore.length + 60;
    decisions.push({
      edge: edgeMeta.semanticId,
      repaired: safe,
      hubId: proposal.hubId,
      satelliteId: proposal.satelliteId,
      hubPortFraction: proposal.hubPortFraction,
      previousBends: currentScore.bends,
      nextBends: nextScore.bends,
      previousLength: Number(currentScore.length.toFixed(1)),
      nextLength: Number(nextScore.length.toFixed(1)),
      previousCrossings: currentScore.crossings,
      nextCrossings: nextScore.crossings
    });
    if (!safe) continue;
    setEdgePoints(edge, proposal.points);
    edgeMeta.route ??= {};
    edgeMeta.route.sourceSide = proposal.sourceSide;
    edgeMeta.route.targetSide = proposal.targetSide;
    edgeMeta.moduleHubSpoke = {
      engine: 'module-hub-spoke-v0.1',
      hubId: proposal.hubId,
      satelliteId: proposal.satelliteId,
      hubPortFraction: proposal.hubPortFraction
    };
    repaired += 1;
  }
  return { considered, repaired, decisions };
}

export function repairModuleRoutes(scene, spec) {
  const memberIds = moduleMemberIds(spec);
  if (memberIds.size === 0) return scene;

  const nodes = new Map();
  const edges = [];
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }
  const bounds = moduleBounds(nodes, memberIds);
  if (!bounds) return scene;

  const hubSpokes = repairHubSpokes(scene, nodes, edges, memberIds, bounds);
  let boundaryConsidered = 0;
  let boundaryRepaired = 0;
  const boundaryDecisions = [];
  for (const edge of edges) {
    const meta = metaOf(edge);
    if (!memberIds.has(meta.from) || !memberIds.has(meta.to)) continue;
    const current = absolutePoints(edge);
    if (!routeEscapes(current, bounds)) continue;
    boundaryConsidered += 1;
    const currentCrossings = crossingCount(current, edge, edges);
    const candidates = routeCandidates(edge, bounds)
      .filter((points) => !routeEscapes(points, bounds))
      .map((points) => ({ points, score: routeScore(points, edge, nodes, edges) }))
      .filter((candidate) => candidate.score.endpointNodePenetrations === 0
        && candidate.score.nodeHits === 0
        && candidate.score.endpointOverlaps === 0
        && candidate.score.crossings <= currentCrossings)
      .sort((a, b) => a.score.crossings - b.score.crossings
        || a.score.bends - b.score.bends
        || a.score.length - b.score.length);
    const chosen = candidates[0];
    boundaryDecisions.push({
      edge: meta.semanticId,
      escapedBefore: true,
      repaired: Boolean(chosen),
      previousCrossings: currentCrossings,
      previousLength: Number(polylineLength(current).toFixed(1)),
      nextCrossings: chosen?.score.crossings ?? null,
      nextBends: chosen?.score.bends ?? null,
      nextLength: chosen ? Number(chosen.score.length.toFixed(1)) : null
    });
    if (!chosen) continue;
    setEdgePoints(edge, chosen.points);
    meta.moduleRouteRepair = { contained: true, engine: 'module-boundary-v0.2' };
    boundaryRepaired += 1;
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  const considered = hubSpokes.considered + boundaryConsidered;
  const repaired = hubSpokes.repaired + boundaryRepaired;
  scene.customData.excalidrawSkill.moduleRouteRepair = {
    version: '0.2.0',
    bounds,
    considered,
    repaired,
    unresolved: Math.max(0, considered - repaired),
    hubSpokesConsidered: hubSpokes.considered,
    hubSpokesRepaired: hubSpokes.repaired,
    hubSpokeDecisions: hubSpokes.decisions,
    boundaryConsidered,
    boundaryRepaired,
    decisions: boundaryDecisions
  };
  return scene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/repair-module-routes.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  const result = repairModuleRoutes(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, result);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    repair: result.customData?.excalidrawSkill?.moduleRouteRepair ?? null
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`repair-module-routes failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
