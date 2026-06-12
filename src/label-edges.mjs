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

function safeId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function makeLabel(edge) {
  const meta = edge.customData?.excalidrawSkill;
  const text = {
    id: safeId('text', `${meta.semanticId}_label`),
    type: 'text',
    x: edge.x + edge.width / 2 - 56,
    y: edge.y + edge.height / 2 - 26,
    width: 112,
    height: 22,
    angle: 0,
    strokeColor: '#374151',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0.7,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text: meta.label,
    originalText: meta.label,
    fontSize: 13,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    containerId: null,
    lineHeight: 1.25,
    customData: {
      excalidrawSkill: {
        semanticId: `${meta.semanticId}_label`,
        role: 'edge-label',
        edge: meta.semanticId
      }
    }
  };
  return text;
}

function run() {
  if (!scenePath) {
    console.error('Usage: node src/label-edges.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const existing = new Set();
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'edge-label') existing.add(meta.edge);
  }

  for (const element of [...(scene.elements ?? [])]) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'edge' && meta.label && !existing.has(meta.semanticId)) {
      scene.elements.push(makeLabel(element));
    }
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

run();
