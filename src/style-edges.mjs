#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE_STYLES = Object.freeze({
  calls: { strokeColor: '#2563eb', strokeStyle: 'solid', role: 'runtime-call' },
  sync: { strokeColor: '#2563eb', strokeStyle: 'solid', role: 'runtime-call' },
  returns: { strokeColor: '#64748b', strokeStyle: 'dashed', role: 'return' },
  'depends-on': { strokeColor: '#64748b', strokeStyle: 'dashed', role: 'dependency' },
  references: { strokeColor: '#64748b', strokeStyle: 'dashed', role: 'dependency' },
  contains: { strokeColor: '#94a3b8', strokeStyle: 'dotted', role: 'containment' },
  async: { strokeColor: '#7c3aed', strokeStyle: 'dashed', role: 'async' },
  publishes: { strokeColor: '#7c3aed', strokeStyle: 'dashed', role: 'async' },
  subscribes: { strokeColor: '#7c3aed', strokeStyle: 'dashed', role: 'async' },
  reads: { strokeColor: '#0f766e', strokeStyle: 'solid', role: 'data-read' },
  writes: { strokeColor: '#b45309', strokeStyle: 'solid', role: 'data-write' },
  transfers: { strokeColor: '#0284c7', strokeStyle: 'solid', role: 'data-transfer' },
  controls: { strokeColor: '#334155', strokeStyle: 'solid', role: 'control' },
  interrupts: { strokeColor: '#dc2626', strokeStyle: 'dashed', role: 'interrupt' },
  retries: { strokeColor: '#d97706', strokeStyle: 'dashed', role: 'retry' },
  'fails-to': { strokeColor: '#dc2626', strokeStyle: 'dashed', role: 'failure' },
  optional: { strokeColor: '#64748b', strokeStyle: 'dashed', role: 'optional' }
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function styleEdges(scene) {
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'edge') continue;

    const style = EDGE_STYLES[meta.kind];
    if (!style) continue;
    element.strokeColor = style.strokeColor;
    element.strokeStyle = style.strokeStyle;
    element.strokeWidth = 2;
    meta.styleRole = style.role;
  }
  return scene;
}

function run() {
  const [scenePath, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePath) {
    console.error('Usage: node src/style-edges.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, styleEdges(readJson(scenePath)));
  console.log(outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();
