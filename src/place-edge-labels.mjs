#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxesOverlap, rectOf, segmentIntersectsRect, segmentLength, segmentsFromEdge } from './geometry.mjs';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`); };
const meta = (element) => element.customData?.excalidrawSkill ?? {};

function specIndex(spec) {
  return new Map((spec?.edges ?? []).map((edge) => [edge.semanticId ?? `${edge.from}_to_${edge.to}`, edge]));
}

function primaryPairs(spec) {
  const flow = spec?.layout?.primaryFlow ?? [];
  return new Set(flow.slice(0, -1).map((id, index) => `${id}->${flow[index + 1]}`));
}

function candidates(edge, label, preferred) {
  const width = label.width || 112;
  const height = label.height || 22;
  const values = [];
  const segments = segmentsFromEdge(edge).sort((a, b) => segmentLength(b) - segmentLength(a));
  for (const segment of segments) {
    const horizontal = Math.abs(segment.b.x - segment.a.x) >= Math.abs(segment.b.y - segment.a.y);
    for (const fraction of [0.5, 0.35, 0.65]) {
      const x = segment.a.x + (segment.b.x - segment.a.x) * fraction;
      const y = segment.a.y + (segment.b.y - segment.a.y) * fraction;
      for (const distance of [14, 32, 52, 78, 106]) {
        if (horizontal) {
          values.push({ x: x - width / 2, y: y - height - distance, width, height, side: 'above', distance });
          values.push({ x: x - width / 2, y: y + distance, width, height, side: 'below', distance });
        } else {
          values.push({ x: x + distance, y: y - height / 2, width, height, side: 'right', distance });
          values.push({ x: x - width - distance, y: y - height / 2, width, height, side: 'left', distance });
        }
      }
    }
  }
  return values.sort((a, b) => {
    const ap = preferred === 'auto' || a.side === preferred ? 0 : 1;
    const bp = preferred === 'auto' || b.side === preferred ? 0 : 1;
    return ap - bp || a.distance - b.distance;
  });
}

function score(candidate, obstacles, placed, otherSegments, preferred, origin) {
  const obstacleHits = obstacles.filter((item) => boxesOverlap(candidate, item)).length;
  const labelHits = placed.filter((item) => boxesOverlap(candidate, item)).length;
  const edgeHits = otherSegments.filter((segment) => segmentIntersectsRect(segment, candidate)).length;
  const preference = preferred === 'auto' || preferred === candidate.side ? 0 : 900;
  return obstacleHits * 100000 + labelHits * 60000 + edgeHits * 2500 + preference
    + candidate.distance * 3 + Math.hypot(candidate.x - origin.x, candidate.y - origin.y) * 0.1;
}

export function placeEdgeLabels(scene, spec = null) {
  const nodes = [];
  const frames = [];
  const edges = new Map();
  const labels = [];
  for (const element of scene.elements ?? []) {
    const data = meta(element);
    if (data.role === 'node') nodes.push(element);
    if (element.type === 'frame' || data.role === 'group-frame') frames.push(element);
    if (data.role === 'edge') edges.set(data.semanticId, element);
    if (data.role === 'edge-label') labels.push(element);
  }

  const specs = specIndex(spec);
  const primary = primaryPairs(spec);
  const obstacles = [...nodes.map((node) => rectOf(node, 8)), ...frames.map((frame) => rectOf(frame, 2))];
  const segments = [...edges.entries()].flatMap(([edgeId, edge]) => segmentsFromEdge(edge).map((segment) => ({ edgeId, segment })));
  const placed = [];

  labels.sort((a, b) => {
    const aEdge = edges.get(meta(a).edge); const bEdge = edges.get(meta(b).edge);
    const am = aEdge ? meta(aEdge) : {}; const bm = bEdge ? meta(bEdge) : {};
    const ap = specs.get(am.semanticId)?.routeHints?.priority === 'primary' || primary.has(`${am.from}->${am.to}`) ? 0 : 1;
    const bp = specs.get(bm.semanticId)?.routeHints?.priority === 'primary' || primary.has(`${bm.from}->${bm.to}`) ? 0 : 1;
    return ap - bp || String(am.semanticId).localeCompare(String(bm.semanticId));
  });

  for (const label of labels) {
    const labelMeta = meta(label);
    const edge = edges.get(labelMeta.edge);
    if (!edge) continue;
    const edgeMeta = meta(edge);
    const preferred = specs.get(edgeMeta.semanticId)?.routeHints?.labelSide ?? 'auto';
    const others = segments.filter((entry) => entry.edgeId !== edgeMeta.semanticId).map((entry) => entry.segment);
    const origin = { x: label.x, y: label.y };
    const options = candidates(edge, label, preferred);
    options.sort((a, b) => score(a, obstacles, placed, others, preferred, origin) - score(b, obstacles, placed, others, preferred, origin));
    const next = options[0];
    if (!next) continue;
    label.x = Math.round(next.x); label.y = Math.round(next.y); label.backgroundColor = '#ffffff';
    labelMeta.placement = { engine: 'collision-aware-v0.3', side: next.side, preferred };
    placed.push(rectOf(label));
  }
  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg) throw new Error('Usage: node src/place-edge-labels.mjs <scene.excalidraw> [spec.json] [-o output.excalidraw]');
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = specArg && specArg !== '-o' ? path.resolve(process.cwd(), specArg) : null;
  const option = specPath ? flag : specArg;
  const output = specPath ? outputArg : flag;
  const outputPath = option === '-o' && output ? path.resolve(process.cwd(), output) : scenePath;
  write(outputPath, placeEdgeLabels(read(scenePath), specPath ? read(specPath) : null));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`place-edge-labels failed: ${error.message}`); process.exit(1); }
}
