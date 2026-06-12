#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [scenePath, flag, outputPathArg] = process.argv.slice(2);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
function absPoints(edge) { return (edge.points ?? [[0, 0], [edge.width ?? 0, edge.height ?? 0]]).map(([x, y]) => ({ x: edge.x + x, y: edge.y + y })); }
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function segment(edge) {
  const pts = absPoints(edge);
  let best = [pts[0], pts[pts.length - 1]];
  let bestLen = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = dist(pts[i], pts[i + 1]);
    if (len > bestLen) { best = [pts[i], pts[i + 1]]; bestLen = len; }
  }
  return best;
}
function box(x, y, w, h) { return { x, y, width: w, height: h }; }
function hit(a, b) { return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }
function hitsAny(candidate, nodes) { return nodes.some((node) => hit(candidate, node)); }
function labelPosition(edge, label, nodes) {
  const [a, b] = segment(edge);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const w = label.width || 112;
  const h = label.height || 22;
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const candidates = horizontal
    ? [box(mx - w / 2, my - h - 14, w, h), box(mx - w / 2, my + 14, w, h), box(mx + 16, my - h / 2, w, h), box(mx - w - 16, my - h / 2, w, h)]
    : [box(mx + 14, my - h / 2, w, h), box(mx - w - 14, my - h / 2, w, h), box(mx - w / 2, my - h - 14, w, h), box(mx - w / 2, my + 14, w, h)];
  return candidates.find((candidate) => !hitsAny(candidate, nodes)) ?? candidates[0];
}

function main() {
  if (!scenePath) {
    console.error('Usage: node src/place-edge-labels.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const nodes = [];
  const edges = new Map();

  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'node') nodes.push(element);
    if (meta?.role === 'edge') edges.set(meta.semanticId, element);
  }

  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'edge-label') continue;
    const edge = edges.get(meta.edge);
    if (!edge) continue;
    const next = labelPosition(edge, element, nodes);
    element.x = next.x;
    element.y = next.y;
    element.backgroundColor = '#ffffff';
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

main();
