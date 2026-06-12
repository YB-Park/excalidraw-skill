#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [scenePath, flag, outputPathArg] = process.argv.slice(2);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
function center(el) { return { x: el.x + el.width / 2, y: el.y + el.height / 2 }; }
function right(el) { return { x: el.x + el.width, y: el.y + el.height / 2 }; }
function left(el) { return { x: el.x, y: el.y + el.height / 2 }; }
function bottom(el) { return { x: el.x + el.width / 2, y: el.y + el.height }; }
function top(el) { return { x: el.x + el.width / 2, y: el.y }; }
function overlapsX(a, b) { return a.x < b.x + b.width && b.x < a.x + a.width; }
function overlapsY(a, b) { return a.y < b.y + b.height && b.y < a.y + a.height; }

function route(from, to, kind) {
  const fromC = center(from);
  const toC = center(to);
  const horizontal = Math.abs(toC.x - fromC.x) >= Math.abs(toC.y - fromC.y);

  if (horizontal && toC.x >= fromC.x) {
    const start = right(from);
    const end = left(to);
    const midX = start.x + Math.max(40, (end.x - start.x) / 2);
    const lane = overlapsY(from, to) ? Math.min(start.y, end.y) - 48 : null;
    if (lane !== null) return [[0, 0], [midX - start.x, lane - start.y], [end.x - start.x, end.y - start.y]];
    return [[0, 0], [end.x - start.x, end.y - start.y]];
  }

  if (horizontal) {
    const start = left(from);
    const end = right(to);
    const midX = start.x - Math.max(40, (start.x - end.x) / 2);
    return [[0, 0], [midX - start.x, start.y < end.y ? 64 : -64], [end.x - start.x, end.y - start.y]];
  }

  if (toC.y >= fromC.y) {
    const start = bottom(from);
    const end = top(to);
    const midY = start.y + Math.max(40, (end.y - start.y) / 2);
    const lane = overlapsX(from, to) ? Math.max(start.x, end.x) + 64 : null;
    if (lane !== null) return [[0, 0], [lane - start.x, midY - start.y], [end.x - start.x, end.y - start.y]];
    return [[0, 0], [end.x - start.x, end.y - start.y]];
  }

  const start = top(from);
  const end = bottom(to);
  return [[0, 0], [end.x - start.x, end.y - start.y]];
}

function main() {
  if (!scenePath) {
    console.error('Usage: node src/route-edges.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const nodes = new Map();
  for (const el of scene.elements ?? []) {
    const meta = el.customData?.excalidrawSkill;
    if (meta?.role === 'node') nodes.set(meta.semanticId, el);
  }

  for (const el of scene.elements ?? []) {
    const meta = el.customData?.excalidrawSkill;
    if (meta?.role !== 'edge') continue;
    const from = nodes.get(meta.from);
    const to = nodes.get(meta.to);
    if (!from || !to) continue;
    const start = center(from);
    const toCenter = center(to);
    const horizontal = Math.abs(toCenter.x - start.x) >= Math.abs(toCenter.y - start.y);
    const anchor = horizontal ? (toCenter.x >= start.x ? right(from) : left(from)) : (toCenter.y >= start.y ? bottom(from) : top(from));
    el.x = anchor.x;
    el.y = anchor.y;
    el.points = route(from, to, meta.kind ?? 'sync');
    const last = el.points[el.points.length - 1];
    el.width = last[0];
    el.height = last[1];
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

main();
