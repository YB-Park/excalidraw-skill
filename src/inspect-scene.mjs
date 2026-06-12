#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node src/inspect-scene.mjs <scene.excalidraw>');
  process.exit(1);
}

const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
const nodes = [];
const edges = [];

for (const element of scene.elements || []) {
  const data = element.customData && element.customData.excalidrawSkill;
  if (!data) continue;
  if (data.role === 'node') nodes.push({ id: data.semanticId, label: data.label, shapeRef: data.shapeRef });
  if (data.role === 'edge') edges.push({ id: data.semanticId, from: data.from, to: data.to, label: data.label, kind: data.kind });
}

console.log(JSON.stringify({ sceneTitle: path.basename(file), nodes, edges }, null, 2));
