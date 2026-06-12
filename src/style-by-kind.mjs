#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [scenePath, flag, outputPathArg] = process.argv.slice(2);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function styleFor(shapeRef = '') {
  if (shapeRef.includes('database')) return { strokeColor: '#0f766e', backgroundColor: '#ecfdf5' };
  if (shapeRef.includes('cache')) return { strokeColor: '#047857', backgroundColor: '#f0fdf4' };
  if (shapeRef.includes('queue')) return { strokeColor: '#7c3aed', backgroundColor: '#f5f3ff' };
  if (shapeRef.includes('gateway')) return { strokeColor: '#2563eb', backgroundColor: '#eff6ff' };
  if (shapeRef.includes('external')) return { strokeColor: '#64748b', backgroundColor: '#f8fafc' };
  if (shapeRef.includes('client') || shapeRef.includes('actor')) return { strokeColor: '#334155', backgroundColor: '#f8fafc' };
  return { strokeColor: '#1f2937', backgroundColor: '#ffffff' };
}

function run() {
  if (!scenePath) {
    console.error('Usage: node src/style-by-kind.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'node') continue;
    const style = styleFor(meta.shapeRef);
    element.strokeColor = style.strokeColor;
    element.backgroundColor = style.backgroundColor;
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

run();
