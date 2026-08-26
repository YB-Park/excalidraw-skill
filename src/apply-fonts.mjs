#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fontTokens, presetNameForScene } from './style-preset.mjs';

const [scenePath, flag, outputPathArg] = process.argv.slice(2);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
function codeLike(value = '') {
  return /[./:_-]/.test(value) || /^(GET|POST|PUT|PATCH|DELETE)\b/i.test(value);
}
function edgeKind(edgeMap, label) {
  const meta = label.customData?.excalidrawSkill;
  return edgeMap.get(meta?.edge)?.customData?.excalidrawSkill?.kind ?? '';
}
function fontFor(element, edgeMap, fonts) {
  const meta = element.customData?.excalidrawSkill ?? {};
  const value = element.text ?? element.originalText ?? '';
  if (meta.fontRole === 'sketch') return fonts.sketch;
  if (meta.fontRole === 'mono') return fonts.mono;
  if (meta.role === 'edge-label' && /async|event|queue/.test(edgeKind(edgeMap, element))) return fonts.mono;
  if (meta.role === 'component-detail' && codeLike(value)) return fonts.mono;
  if (codeLike(value) && value.length <= 40) return fonts.mono;
  return fonts.default;
}

function main() {
  if (!scenePath) {
    console.error('Usage: node src/apply-fonts.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const fonts = fontTokens(presetNameForScene(scene));
  const edgeMap = new Map();
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'edge') edgeMap.set(meta.semanticId, element);
  }

  for (const element of scene.elements ?? []) {
    if (element.type !== 'text') continue;
    element.fontFamily = fontFor(element, edgeMap, fonts);
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

main();
