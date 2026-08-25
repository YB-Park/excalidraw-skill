#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentLength, segmentsFromEdge } from './geometry.mjs';
import { placeEdgeLabels } from './place-edge-labels.mjs';

const meta = (element) => element.customData?.excalidrawSkill ?? {};

function pairKey(from, to) {
  return [String(from), String(to)].sort().join('::');
}

function sidePair(edge) {
  const segments = segmentsFromEdge(edge).sort((a, b) => segmentLength(b) - segmentLength(a));
  const segment = segments[0];
  if (!segment) return ['left', 'right'];
  const horizontal = Math.abs(segment.b.x - segment.a.x) >= Math.abs(segment.b.y - segment.a.y);
  return horizontal ? ['above', 'below'] : ['left', 'right'];
}

export function reciprocalLabelSides(scene) {
  const groups = new Map();
  for (const element of scene?.elements ?? []) {
    const data = meta(element);
    if (data.role !== 'edge' || !data.semanticId || !data.from || !data.to) continue;
    const key = pairKey(data.from, data.to);
    const group = groups.get(key) ?? [];
    group.push({ edge: element, id: data.semanticId, from: data.from, to: data.to });
    groups.set(key, group);
  }

  const result = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const reciprocal = group.some((entry) => group.some((other) => entry.from === other.to && entry.to === other.from));
    if (!reciprocal) continue;
    const ordered = [...group].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const sides = sidePair(ordered[0].edge);
    ordered.forEach((entry, index) => result.set(entry.id, sides[index % sides.length]));
  }
  return result;
}

export function separateReciprocalLabels(scene, spec = null) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  const preferences = reciprocalLabelSides(scene);
  if (preferences.size === 0) return scene;

  const nextSpec = JSON.parse(JSON.stringify(spec ?? { edges: [] }));
  nextSpec.edges ??= [];
  const byId = new Map(nextSpec.edges.map((edge) => [edge.semanticId ?? `${edge.from}_to_${edge.to}`, edge]));
  for (const [edgeId, side] of preferences) {
    const edge = byId.get(edgeId);
    if (!edge) continue;
    edge.routeHints ??= {};
    if (!edge.routeHints.labelSide) edge.routeHints.labelSide = side;
  }

  placeEdgeLabels(scene, nextSpec);
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.reciprocalLabelSeparation = {
    version: '0.1.0',
    strategy: 'opposite-sides-by-dominant-axis',
    edges: Object.fromEntries(preferences)
  };
  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg) throw new Error('Usage: node src/separate-reciprocal-labels.mjs <scene.excalidraw> [spec.json] [-o output.excalidraw]');
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = specArg && specArg !== '-o' ? path.resolve(process.cwd(), specArg) : null;
  const option = specPath ? flag : specArg;
  const output = specPath ? outputArg : flag;
  const outputPath = option === '-o' && output ? path.resolve(process.cwd(), output) : scenePath;
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const spec = specPath ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : null;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(separateReciprocalLabels(scene, spec), null, 2)}\n`);
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`separate-reciprocal-labels failed: ${error.message}`); process.exit(1); }
}
