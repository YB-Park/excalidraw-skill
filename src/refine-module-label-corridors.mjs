#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_COLUMN_GAP = 220;

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function collect(scene) {
  const nodes = new Map();
  const labels = new Map();
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && meta.semanticId) nodes.set(meta.semanticId, element);
    if (meta.role === 'label' && meta.node) {
      const list = labels.get(meta.node) ?? [];
      list.push(element);
      labels.set(meta.node, list);
    }
  }
  return { nodes, labels };
}

function moveX(node, labels, dx) {
  node.x += dx;
  for (const label of labels) label.x += dx;
}

export function refineModuleLabelCorridors(scene, spec = null) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (spec?.diagramType !== 'module-architecture') return scene;
  const layout = scene.customData?.excalidrawSkill?.layout;
  if (layout?.strategy !== 'hub-grid' || !layout?.hubId) return scene;

  const { nodes, labels } = collect(scene);
  const hub = nodes.get(layout.hubId);
  if (!hub) return scene;
  const hubRight = hub.x + hub.width;
  const rightInternal = [...nodes.values()]
    .filter((node) => metaOf(node).moduleScope === 'internal' && node.x > hub.x + hub.width / 2)
    .sort((a, b) => a.x - b.x);
  if (rightInternal.length === 0) return scene;

  const currentGap = rightInternal[0].x - hubRight;
  const shift = Math.max(0, TARGET_COLUMN_GAP - currentGap);
  if (shift <= 0) {
    scene.customData.excalidrawSkill.moduleLabelCorridors = {
      version: '0.1.0',
      targetGap: TARGET_COLUMN_GAP,
      previousGap: currentGap,
      appliedShift: 0
    };
    return scene;
  }

  for (const node of nodes.values()) {
    const meta = metaOf(node);
    const moveInternal = meta.moduleScope === 'internal' && node.x > hub.x + hub.width / 2;
    const moveRightExternal = meta.moduleScope === 'external' && node.x > hub.x;
    if (!moveInternal && !moveRightExternal) continue;
    moveX(node, labels.get(meta.semanticId) ?? [], shift);
  }

  if (layout.boundary) layout.boundary.width += shift;
  scene.customData.excalidrawSkill.moduleLabelCorridors = {
    version: '0.1.0',
    strategy: 'reserve-hub-to-right-column-label-corridor',
    targetGap: TARGET_COLUMN_GAP,
    previousGap: currentGap,
    appliedShift: shift
  };
  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) throw new Error('Usage: node src/refine-module-label-corridors.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(refineModuleLabelCorridors(scene, spec), null, 2)}\n`);
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`refine-module-label-corridors failed: ${error.message}`); process.exit(1); }
}
