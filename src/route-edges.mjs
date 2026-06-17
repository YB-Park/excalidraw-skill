#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collinearOverlapLength, polylineLength, rectOf, segmentIntersectsRect, segmentsFromPoints, segmentsIntersect } from './geometry.mjs';

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`); }
function center(el) { return { x: el.x + el.width / 2, y: el.y + el.height / 2 }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function metaOf(el) { return el.customData?.excalidrawSkill ?? {}; }

function sideFor(from, to, hint = 'auto') {
  if (hint === 'right' || hint === 'left' || hint === 'up' || hint === 'down') return hint;
  const a = center(from); const b = center(to);
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) return b.x >= a.x ? 'right' : 'left';
  return b.y >= a.y ? 'down' : 'up';
}

function anchor(node, side, offset = 0) {
  if (side === 'right') return { x: node.x + node.width, y: clamp(node.y + node.height / 2 + offset, node.y + 12, node.y + node.height - 12) };
  if (side === 'left') return { x: node.x, y: clamp(node.y + node.height / 2 + offset, node.y + 12, node.y + node.height - 12) };
  if (side === 'down') return { x: clamp(node.x + node.width / 2 + offset, node.x + 12, node.x + node.width - 12), y: node.y + node.height };
  return { x: clamp(node.x + node.width / 2 + offset, node.x + 12, node.x + node.width - 12), y: node.y };
}

function opposite(side) { return ({ right: 'left', left: 'right', up: 'down', down: 'up' })[side]; }
function dedupe(points) { return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y); }

function candidates(start, end, side, bounds, laneOffset) {
  const result = [];
  const horizontal = side === 'right' || side === 'left';
  if (horizontal) {
    result.push(dedupe([start, { x: end.x, y: start.y }, end]));
    result.push(dedupe([start, { x: start.x, y: end.y }, end]));
    const midX = (start.x + end.x) / 2 + laneOffset;
    result.push(dedupe([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]));
    for (const bypassY of [bounds.top - 70 - Math.abs(laneOffset), bounds.bottom + 70 + Math.abs(laneOffset)]) {
      const stub = side === 'right' ? 36 : -36;
      const endStub = side === 'right' ? -36 : 36;
      result.push(dedupe([start, { x: start.x + stub, y: start.y }, { x: start.x + stub, y: bypassY }, { x: end.x + endStub, y: bypassY }, { x: end.x + endStub, y: end.y }, end]));
    }
  } else {
    result.push(dedupe([start, { x: start.x, y: end.y }, end]));
    result.push(dedupe([start, { x: end.x, y: start.y }, end]));
    const midY = (start.y + end.y) / 2 + laneOffset;
    result.push(dedupe([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]));
    for (const bypassX of [bounds.left - 70 - Math.abs(laneOffset), bounds.right + 70 + Math.abs(laneOffset)]) {
      const stub = side === 'down' ? 36 : -36;
      const endStub = side === 'down' ? -36 : 36;
      result.push(dedupe([start, { x: start.x, y: start.y + stub }, { x: bypassX, y: start.y + stub }, { x: bypassX, y: end.y + endStub }, { x: end.x, y: end.y + endStub }, end]));
    }
  }
  return result;
}

function sceneBounds(nodes) {
  const values = [...nodes.values()];
  return {
    left: Math.min(...values.map((n) => n.x)),
    right: Math.max(...values.map((n) => n.x + n.width)),
    top: Math.min(...values.map((n) => n.y)),
    bottom: Math.max(...values.map((n) => n.y + n.height))
  };
}

function routeScore(points, obstacles, existingSegments, priority) {
  const segments = segmentsFromPoints(points);
  let nodeHits = 0; let crossings = 0; let overlap = 0;
  for (const segment of segments) {
    nodeHits += obstacles.filter((rect) => segmentIntersectsRect(segment, rect)).length;
    for (const other of existingSegments) {
      if (segmentsIntersect(segment, other, { includeEndpoints: false })) crossings += 1;
      overlap += collinearOverlapLength(segment, other);
    }
  }
  return nodeHits * 100000 + crossings * (priority === 'primary' ? 5000 : 1600) + overlap * 12 + polylineLength(points) + Math.max(0, points.length - 2) * 70;
}

function edgeSpecMap(spec) { return new Map((spec?.edges ?? []).map((edge) => [edge.semanticId ?? `${edge.from}_to_${edge.to}`, edge])); }
function primaryPairs(spec) {
  const ids = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let i = 0; i < ids.length - 1; i += 1) pairs.add(`${ids[i]}->${ids[i + 1]}`);
  return pairs;
}

function portOffsets(edges, nodes, specs) {
  const outgoing = new Map(); const incoming = new Map();
  for (const edge of edges) {
    const meta = metaOf(edge); const from = nodes.get(meta.from); const to = nodes.get(meta.to); if (!from || !to) continue;
    const hint = specs.get(meta.semanticId)?.routeHints?.direction ?? 'auto';
    const side = sideFor(from, to, hint); const endSide = opposite(side);
    const outKey = `${meta.from}:${side}`; const inKey = `${meta.to}:${endSide}`;
    (outgoing.get(outKey) ?? outgoing.set(outKey, []).get(outKey)).push({ edge, to });
    (incoming.get(inKey) ?? incoming.set(inKey, []).get(inKey)).push({ edge, from });
  }
  const offsets = new Map();
  const assign = (groups, field) => {
    for (const list of groups.values()) {
      list.sort((a, b) => center(a[field]).y - center(b[field]).y || center(a[field]).x - center(b[field]).x || metaOf(a.edge).semanticId.localeCompare(metaOf(b.edge).semanticId));
      list.forEach(({ edge }, index) => {
        const current = offsets.get(edge.id) ?? { start: 0, end: 0 };
        current[field === 'to' ? 'start' : 'end'] = (index - (list.length - 1) / 2) * 16;
        offsets.set(edge.id, current);
      });
    }
  };
  assign(outgoing, 'to'); assign(incoming, 'from');
  return offsets;
}

export function routeEdges(scene, spec = null) {
  const nodes = new Map(); const edges = [];
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }
  if (nodes.size === 0) return scene;
  const specs = edgeSpecMap(spec); const primary = primaryPairs(spec); const offsets = portOffsets(edges, nodes, specs); const bounds = sceneBounds(nodes);
  edges.sort((a, b) => {
    const am = metaOf(a); const bm = metaOf(b); const as = specs.get(am.semanticId); const bs = specs.get(bm.semanticId);
    const ap = as?.routeHints?.priority === 'primary' || primary.has(`${am.from}->${am.to}`) ? 0 : 1;
    const bp = bs?.routeHints?.priority === 'primary' || primary.has(`${bm.from}->${bm.to}`) ? 0 : 1;
    return ap - bp || am.semanticId.localeCompare(bm.semanticId);
  });
  const existingSegments = []; const channelUsage = new Map();
  for (const edge of edges) {
    const meta = metaOf(edge); const from = nodes.get(meta.from); const to = nodes.get(meta.to); if (!from || !to) continue;
    const edgeSpec = specs.get(meta.semanticId); const priority = edgeSpec?.routeHints?.priority ?? (primary.has(`${meta.from}->${meta.to}`) ? 'primary' : 'secondary');
    const side = sideFor(from, to, edgeSpec?.routeHints?.direction ?? 'auto'); const port = offsets.get(edge.id) ?? { start: 0, end: 0 };
    const start = anchor(from, side, port.start); const end = anchor(to, opposite(side), port.end);
    const channelKey = `${side}:${Math.round((side === 'right' || side === 'left' ? (start.x + end.x) / 2 : (start.y + end.y) / 2) / 40)}`;
    const laneIndex = channelUsage.get(channelKey) ?? 0; channelUsage.set(channelKey, laneIndex + 1);
    const laneOffset = laneIndex === 0 ? 0 : Math.ceil(laneIndex / 2) * 22 * (laneIndex % 2 === 1 ? 1 : -1);
    const obstacles = [...nodes.entries()].filter(([id]) => id !== meta.from && id !== meta.to).map(([, node]) => rectOf(node, 18));
    const options = candidates(start, end, side, bounds, laneOffset);
    const clearance = 36 + Math.abs(laneOffset);
    if (side === 'down' || side === 'up') {
      const stubY = start.y + (side === 'down' ? clearance : -clearance);
      for (const targetSide of ['left', 'right']) {
        const sideEnd = anchor(to, targetSide, port.end);
        const channelX = targetSide === 'left' ? Math.min(start.x, to.x) - clearance : Math.max(start.x, to.x + to.width) + clearance;
        options.push(dedupe([start, { x: start.x, y: stubY }, { x: channelX, y: stubY }, { x: channelX, y: sideEnd.y }, sideEnd]));
      }
    } else {
      const stubX = start.x + (side === 'right' ? clearance : -clearance);
      for (const targetSide of ['up', 'down']) {
        const sideEnd = anchor(to, targetSide, port.end);
        const channelY = targetSide === 'up' ? Math.min(start.y, to.y) - clearance : Math.max(start.y, to.y + to.height) + clearance;
        options.push(dedupe([start, { x: stubX, y: start.y }, { x: stubX, y: channelY }, { x: sideEnd.x, y: channelY }, sideEnd]));
      }
    }
    options.sort((a, b) => routeScore(a, obstacles, existingSegments, priority) - routeScore(b, obstacles, existingSegments, priority));
    const chosen = options[0] ?? [start, end];
    edge.x = chosen[0].x; edge.y = chosen[0].y; edge.points = chosen.map((point) => [point.x - edge.x, point.y - edge.y]);
    const last = edge.points.at(-1); edge.width = last[0]; edge.height = last[1];
    meta.route = { engine: 'graph-aware-v0.3', priority, side, bends: Math.max(0, chosen.length - 2) };
    existingSegments.push(...segmentsFromPoints(chosen));
  }
  return scene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) { console.error('Usage: node src/route-edges.mjs <scene.excalidraw> [spec.json] [-o output.excalidraw]'); process.exit(1); }
  const scenePath = path.resolve(process.cwd(), scenePathArg); const specPath = specPathArg && specPathArg !== '-o' ? path.resolve(process.cwd(), specPathArg) : null;
  const actualFlag = specPath ? flag : specPathArg; const actualOutput = specPath ? outputPathArg : flag;
  const outputPath = actualFlag === '-o' && actualOutput ? path.resolve(process.cwd(), actualOutput) : scenePath;
  writeJson(outputPath, routeEdges(readJson(scenePath), specPath ? readJson(specPath) : null)); console.log(path.relative(process.cwd(), outputPath) || outputPath);
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) { try { main(); } catch (error) { console.error(`route-edges failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); } }
