#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? null;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function collect(scene) {
  const nodes = new Map();
  const labels = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta?.role === 'node' && typeof meta.semanticId === 'string') {
      nodes.set(meta.semanticId, element);
    }
    if (meta?.role === 'label' && typeof meta.node === 'string') {
      const list = labels.get(meta.node) ?? [];
      list.push(element);
      labels.set(meta.node, list);
    }
  }
  return { nodes, labels };
}

function isOutside(node, focusModule) {
  if (focusModule && node.group === focusModule) return false;
  const shape = String(node.shapeRef ?? node.kind ?? '').toLowerCase();
  const group = String(node.group ?? '').toLowerCase();
  return shape.includes('client') || shape.includes('external') || group.includes('external');
}

function applyMove(node, labels, x, y) {
  const dx = x - finite(node.x, 0);
  const dy = y - finite(node.y, 0);
  node.x = Math.round(x);
  node.y = Math.round(y);
  for (const label of labels) {
    label.x = finite(label.x, 0) + dx;
    label.y = finite(label.y, 0) + dy;
  }
}

export function layoutModuleArchitecture(scene, spec) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (!spec || typeof spec !== 'object') throw new TypeError('DiagramSpec JSON must be an object');
  if (spec.diagramType !== 'module-architecture') return scene;
  const profile = spec.layout?.profile ?? 'component-view';
  if (profile !== 'component-view') return scene;

  const { nodes, labels } = collect(scene);
  const focusModule = spec.module?.focusModule ?? 'focus-module';
  const inside = [];
  const outside = [];

  (spec.nodes ?? []).forEach((node, index) => {
    const entry = { node, index };
    if (isOutside(node, focusModule)) outside.push(entry);
    else inside.push(entry);
  });

  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, inside.length))));
  const nodeWidth = Math.max(180, ...inside.map(({ node }) => finite(nodes.get(node.semanticId)?.width, 180)));
  const nodeHeight = Math.max(80, ...inside.map(({ node }) => finite(nodes.get(node.semanticId)?.height, 80)));
  const originX = 380;
  const originY = 180;
  const gapX = 90;
  const gapY = 90;

  inside.forEach(({ node }, index) => {
    const element = nodes.get(node.semanticId);
    if (!element) return;
    const column = index % columns;
    const row = Math.floor(index / columns);
    applyMove(element, labels.get(node.semanticId) ?? [], originX + column * (nodeWidth + gapX), originY + row * (nodeHeight + gapY));
    const meta = metaOf(element);
    if (meta) {
      meta.moduleScope = 'internal';
      meta.moduleBoundary = focusModule;
    }
  });

  const rows = Math.max(1, Math.ceil(inside.length / columns));
  const boundaryWidth = columns * nodeWidth + Math.max(0, columns - 1) * gapX;
  const boundaryHeight = rows * nodeHeight + Math.max(0, rows - 1) * gapY;
  outside.forEach(({ node }, index) => {
    const element = nodes.get(node.semanticId);
    if (!element) return;
    const lane = node.layoutHints?.lane === 'right' ? 'right' : 'left';
    const x = lane === 'right' ? originX + boundaryWidth + 220 : originX - nodeWidth - 220;
    const y = originY + index * (nodeHeight + gapY);
    applyMove(element, labels.get(node.semanticId) ?? [], x, y);
    const meta = metaOf(element);
    if (meta) meta.moduleScope = 'external';
  });

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layout = {
    engine: 'module-architecture-v0.1',
    family: 'module-architecture',
    profile,
    focusModule,
    internalIds: inside.map(({ node }) => node.semanticId),
    externalIds: outside.map(({ node }) => node.semanticId),
    boundary: { x: originX - 60, y: originY - 60, width: boundaryWidth + 120, height: boundaryHeight + 120 }
  };

  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) {
    console.error('Usage: node src/layout-module-architecture.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  writeJson(outputPath, layoutModuleArchitecture(readJson(scenePath), readJson(specPath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
