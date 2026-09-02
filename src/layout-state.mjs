#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

export function captureLayoutState(scene) {
  const nodes = {};
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role !== 'node' || typeof meta.semanticId !== 'string') continue;
    nodes[meta.semanticId] = {
      x: Number(element.x),
      y: Number(element.y),
      width: Number(element.width),
      height: Number(element.height),
      locked: true
    };
  }
  return {
    version: '1.0',
    coordinateSpace: 'excalidraw-scene',
    nodes
  };
}

export function applyLayoutState(scene, layoutState) {
  const next = structuredClone(scene);
  const byId = new Map((next.elements ?? []).map((element) => [element.id, element]));
  const moves = [];

  for (const element of next.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role !== 'node' || typeof meta.semanticId !== 'string') continue;
    const desired = layoutState?.nodes?.[meta.semanticId];
    if (!desired || desired.locked === false) continue;
    const dx = Number(desired.x) - Number(element.x);
    const dy = Number(desired.y) - Number(element.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) continue;

    element.x += dx;
    element.y += dy;
    for (const bound of element.boundElements ?? []) {
      const child = byId.get(bound.id);
      if (child?.type === 'text') {
        child.x += dx;
        child.y += dy;
      }
    }
    moves.push({ semanticId: meta.semanticId, dx, dy });
  }

  return { scene: next, moves };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const [command, scenePath, statePath] = process.argv.slice(2);
  if (command === 'capture' && scenePath) {
    const output = statePath ?? `${scenePath}.layout-state.json`;
    writeJson(output, captureLayoutState(readJson(scenePath)));
    console.log(output);
    return;
  }
  if (command === 'apply' && scenePath && statePath) {
    const result = applyLayoutState(readJson(scenePath), readJson(statePath));
    writeJson(scenePath, result.scene);
    console.log(JSON.stringify({ scenePath, moves: result.moves }, null, 2));
    return;
  }
  console.error('Usage: layout-state <capture|apply> <scene.excalidraw> [layout-state.json]');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
