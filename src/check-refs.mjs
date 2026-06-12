#!/usr/bin/env node

import fs from 'node:fs';

const [scenePath, patchPath] = process.argv.slice(2);
if (!scenePath || !patchPath) {
  console.error('Usage: node src/check-refs.mjs <scene.excalidraw> <patch.json>');
  process.exit(1);
}

const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
const ids = new Set();
let ok = true;

for (const element of scene.elements ?? []) {
  const meta = element.customData?.excalidrawSkill;
  if (meta?.role === 'node' && meta.semanticId) ids.add(meta.semanticId);
}

function requireId(id) {
  if (!ids.has(id)) {
    console.error(`Missing node: ${id}`);
    ok = false;
  }
}

for (const op of patch.operations ?? []) {
  if (op.op === 'addNode') {
    if (op.near) requireId(op.near);
    if (op.semanticId) ids.add(op.semanticId);
  }
  if (op.op === 'addEdge') {
    requireId(op.from);
    requireId(op.to);
  }
  if (op.op === 'updateLabel') {
    requireId(op.target);
  }
}

if (!ok) process.exit(1);
console.log('check-refs: ok');
