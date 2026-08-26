#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  edgeKindStyleFor,
  edgeVisualStyleFor,
  presetNameForScene
} from './style-preset.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function applyStyle(element, style) {
  element.strokeColor = style.strokeColor;
  element.strokeStyle = style.strokeStyle;
  element.strokeWidth = style.strokeWidth;
  if (Number.isFinite(style.opacity)) element.opacity = style.opacity;
}

export function styleEdges(scene, preset = presetNameForScene(scene)) {
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'edge') continue;

    if (meta.visual) {
      const { visual, style } = edgeVisualStyleFor(meta.visual, preset);
      applyStyle(element, style);
      meta.visual = visual;
      meta.styleRole = visual.role === 'default' ? 'visual-default' : `visual-${visual.role}`;
      meta.styleSource = 'edge.visual';
      continue;
    }

    const style = edgeKindStyleFor(meta.kind, preset);
    if (!style) continue;
    applyStyle(element, style);
    meta.styleRole = style.role;
    meta.styleSource = 'kind';
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
