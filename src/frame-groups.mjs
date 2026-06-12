#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [scenePath, specPath, flag, outputPathArg] = process.argv.slice(2);

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

function makeFrame(groupName, boxes) {
  const pad = 48;
  const left = Math.min(...boxes.map((box) => box.x)) - pad;
  const top = Math.min(...boxes.map((box) => box.y)) - pad;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + pad;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + pad;

  return {
    id: safeId('frame', groupName),
    type: 'frame',
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    angle: 0,
    strokeColor: '#9ca3af',
    backgroundColor: '#f8fafc',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0.6,
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
    name: groupName,
    customData: {
      excalidrawSkill: {
        semanticId: groupName,
        role: 'frame'
      }
    }
  };
}

function run() {
  if (!scenePath || !specPath) {
    console.error('Usage: node src/frame-groups.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const spec = readJson(specPath);
  const groups = new Map();
  const nodeGroups = new Map();

  for (const node of spec.nodes ?? []) {
    if (node.group) nodeGroups.set(node.semanticId, node.group);
  }

  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'node') continue;
    const group = nodeGroups.get(meta.semanticId);
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(element);
  }

  const existingFrames = new Set(
    (scene.elements ?? [])
      .map((element) => element.customData?.excalidrawSkill)
      .filter((meta) => meta?.role === 'frame')
      .map((meta) => meta.semanticId)
  );

  const frames = [];
  for (const [groupName, boxes] of groups.entries()) {
    if (boxes.length === 0 || existingFrames.has(groupName)) continue;
    frames.push(makeFrame(groupName, boxes));
  }

  scene.elements = [...frames, ...(scene.elements ?? [])];
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

run();
