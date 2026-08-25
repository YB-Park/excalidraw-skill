#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function area(element) {
  return Math.max(0, Number(element.width ?? 0)) * Math.max(0, Number(element.height ?? 0));
}

function contains(frame, element) {
  const left = Number(element.x ?? 0);
  const top = Number(element.y ?? 0);
  const right = left + Number(element.width ?? 0);
  const bottom = top + Number(element.height ?? 0);
  return left >= frame.x
    && top >= frame.y
    && right <= frame.x + frame.width
    && bottom <= frame.y + frame.height;
}

export function assignFrameMembership(scene) {
  const elements = scene?.elements ?? [];
  const frames = elements
    .filter((element) => metaOf(element).role === 'frame' && element.type === 'frame')
    .sort((a, b) => area(a) - area(b));

  if (frames.length === 0) return scene;

  const frameByNode = new Map();
  for (const element of elements) {
    const meta = metaOf(element);
    if (meta.role !== 'node') continue;
    const frame = frames.find((candidate) => contains(candidate, element));
    if (!frame) continue;
    element.frameId = frame.id;
    frameByNode.set(meta.semanticId, frame.id);
  }

  for (const element of elements) {
    const meta = metaOf(element);
    if (meta.role === 'label' && frameByNode.has(meta.node)) {
      element.frameId = frameByNode.get(meta.node);
      continue;
    }
    if (meta.role === 'component-detail') {
      const frame = frames.find((candidate) => contains(candidate, element));
      if (frame) element.frameId = frame.id;
    }
  }

  return scene;
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/assign-frame-membership.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  writeJson(outputPath, assignFrameMembership(readJson(scenePath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
