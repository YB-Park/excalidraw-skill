#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_STYLE_PRESET,
  nodeStyleFor,
  presetNameForScene,
  roleFor as resolveRole
} from './style-preset.mjs';

export function roleFor(shapeRef = '') {
  return resolveRole(shapeRef);
}

export function styleFor(shapeRef = '', preset = DEFAULT_STYLE_PRESET) {
  return nodeStyleFor(shapeRef, preset);
}

export function styleByKind(scene, preset = presetNameForScene(scene)) {
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'node') continue;
    const style = styleFor(meta.shapeRef, preset);
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
