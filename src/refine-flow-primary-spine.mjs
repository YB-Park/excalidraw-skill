#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FLOW_TYPES = new Set(['flow', 'service-flow', 'event-flow', 'data-flow']);

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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function nodeCenter(node, direction) {
  return direction === 'top-to-bottom'
    ? Number(node.x ?? 0) + Number(node.width ?? 0) / 2
    : Number(node.y ?? 0) + Number(node.height ?? 0) / 2;
}

function labelsByNode(scene) {
  const labels = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role !== 'label' || typeof meta.node !== 'string') continue;
    const list = labels.get(meta.node) ?? [];
    list.push(element);
    labels.set(meta.node, list);
  }
  return labels;
}

export function refineFlowPrimarySpine(scene, spec) {
  if (!FLOW_TYPES.has(spec?.diagramType)) return scene;
  if ((spec.layout?.profile ?? 'layered-flow') !== 'layered-flow') return scene;

  const primaryIds = Array.isArray(spec.layout?.primaryFlow) ? spec.layout.primaryFlow : [];
  if (primaryIds.length < 2) return scene;
  const primarySet = new Set(primaryIds);
  const nodes = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && primarySet.has(meta.semanticId)) nodes.set(meta.semanticId, element);
  }
  const primary = primaryIds.map((id) => nodes.get(id)).filter(Boolean);
  if (primary.length < 2) return scene;

  const direction = spec.layout?.direction ?? 'left-to-right';
  const axis = direction === 'top-to-bottom' ? 'x' : 'y';
  const centers = primary.map((node) => nodeCenter(node, direction));
  const targetCenter = median(centers);
  const labels = labelsByNode(scene);
  const moves = [];

  for (const id of primaryIds) {
    const node = nodes.get(id);
    if (!node) continue;
    const previousCenter = nodeCenter(node, direction);
    const delta = targetCenter - previousCenter;
    if (Math.abs(delta) < 0.5) continue;
    if (axis === 'y') node.y = Number(node.y ?? 0) + delta;
    else node.x = Number(node.x ?? 0) + delta;
    for (const label of labels.get(id) ?? []) {
      if (axis === 'y') label.y = Number(label.y ?? 0) + delta;
      else label.x = Number(label.x ?? 0) + delta;
    }
    moves.push({
      node: id,
      axis,
      delta: Number(delta.toFixed(2)),
      previousCenter: Number(previousCenter.toFixed(2)),
      targetCenter: Number(targetCenter.toFixed(2))
    });
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.primarySpineRefinement = {
    version: '0.1.0',
    strategy: 'median-center-alignment',
    profile: 'layered-flow',
    direction,
    axis,
    targetCenter: Number(targetCenter.toFixed(2)),
    moved: moves.length,
    moves
  };
  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) {
    console.error('Usage: node src/refine-flow-primary-spine.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  const result = refineFlowPrimarySpine(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, result);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    refinement: result.customData?.excalidrawSkill?.primarySpineRefinement ?? null
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`refine-flow-primary-spine failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
