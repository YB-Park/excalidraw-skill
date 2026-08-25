#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const roles = {
  actor: { strokeColor: '#475569', backgroundColor: '#f8fafc' },
  client: { strokeColor: '#475569', backgroundColor: '#f8fafc' },
  gateway: { strokeColor: '#2563eb', backgroundColor: '#eff6ff' },
  service: { strokeColor: '#4f46e5', backgroundColor: '#eef2ff' },
  worker: { strokeColor: '#7c3aed', backgroundColor: '#f5f3ff' },
  data: { strokeColor: '#0f766e', backgroundColor: '#f0fdfa' },
  cache: { strokeColor: '#16a34a', backgroundColor: '#f0fdf4' },
  queue: { strokeColor: '#9333ea', backgroundColor: '#faf5ff' },
  external: { strokeColor: '#64748b', backgroundColor: '#f8fafc' },
  risk: { strokeColor: '#d97706', backgroundColor: '#fffbeb' },
  model: { strokeColor: '#334155', backgroundColor: '#f8fafc' },
  boundary: { strokeColor: '#cbd5e1', backgroundColor: '#f8fafc' }
};

export function roleFor(shapeRef = '') {
  if (shapeRef.includes('actor')) return 'actor';
  if (shapeRef.includes('client')) return 'client';
  if (shapeRef.includes('gateway')) return 'gateway';
  if (shapeRef.includes('worker')) return 'worker';
  if (shapeRef.includes('database') || shapeRef.includes('storage')) return 'data';
  if (shapeRef.includes('cache')) return 'cache';
  if (shapeRef.includes('queue')) return 'queue';
  if (shapeRef.includes('external')) return 'external';
  if (shapeRef.includes('risk') || shapeRef.includes('security')) return 'risk';
  if (shapeRef.includes('state') || shapeRef.includes('domain') || shapeRef.includes('process')) return 'model';
  if (shapeRef.includes('boundary') || shapeRef.includes('cloud') || shapeRef.includes('network') || shapeRef.includes('k8s')) return 'boundary';
  return 'service';
}

export function styleFor(shapeRef = '') {
  return roles[roleFor(shapeRef)] ?? roles.service;
}

export function styleByKind(scene) {
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'node') continue;
    const style = styleFor(meta.shapeRef);
    element.strokeColor = style.strokeColor;
    element.backgroundColor = style.backgroundColor;
  }
  return scene;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function main() {
  const [scenePath, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePath) {
    console.error('Usage: node src/style-by-kind.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = styleByKind(readJson(scenePath));
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
