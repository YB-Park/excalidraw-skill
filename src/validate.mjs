#!/usr/bin/env node

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node src/validate.mjs <scene.excalidraw>');
  process.exit(1);
}

const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];

if (scene.type !== 'excalidraw') errors.push('type must be excalidraw');
if (!Array.isArray(scene.elements)) errors.push('elements must be an array');
if (!scene.appState) errors.push('appState is missing');

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, elements: scene.elements.length }, null, 2));
