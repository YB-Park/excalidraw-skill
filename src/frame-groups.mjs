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

function safeId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function frameBudget(nodeCount, policy = {}) {
  if (Number.isInteger(policy.maxFrames) && policy.maxFrames >= 0) return policy.maxFrames;
  if (nodeCount <= 1) return 0;
  return Math.min(3, Math.max(1, Math.floor(nodeCount / 3)));
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
        role: 'frame',
        generatedBy: 'frame-groups',
        memberCount: boxes.length
      }
    }
  };
}

export function frameSceneGroups(scene, spec) {
  const groups = new Map();
  const nodeGroups = new Map();
  const policy = spec.framePolicy ?? spec.layout?.framePolicy ?? {};
  const allowSingletons = policy.allowSingletons === true;
  const allowFullScene = policy.allowFullScene === true;
  const preferredGroups = new Set(policy.include ?? []);

  for (const node of spec.nodes ?? []) {
    if (node.group) nodeGroups.set(node.semanticId, node.group);
  }

  const sceneNodes = [];
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'node') continue;
    sceneNodes.push(element);
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

  const minimumMembers = allowSingletons ? 1 : 2;
  const budget = frameBudget(sceneNodes.length, policy);
  const candidates = [...groups.entries()]
    .filter(([groupName, boxes]) => !existingFrames.has(groupName)
      && boxes.length >= minimumMembers
      && (allowFullScene || boxes.length < sceneNodes.length))
    .sort((first, second) => {
      const firstPreferred = preferredGroups.has(first[0]) ? 1 : 0;
      const secondPreferred = preferredGroups.has(second[0]) ? 1 : 0;
      return secondPreferred - firstPreferred
        || second[1].length - first[1].length
        || first[0].localeCompare(second[0]);
    })
    .slice(0, budget);

  const frames = candidates.map(([groupName, boxes]) => makeFrame(groupName, boxes));
  return {
    ...scene,
    elements: [...frames, ...(scene.elements ?? [])],
    customData: {
      ...(scene.customData ?? {}),
      excalidrawSkill: {
        ...(scene.customData?.excalidrawSkill ?? {}),
        framePolicy: {
          budget,
          candidateCount: groups.size,
          renderedCount: frames.length,
          suppressedSingletons: [...groups.values()].filter((boxes) => boxes.length === 1).length
        }
      }
    }
  };
}

function run() {
  const [scenePath, specPath, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePath || !specPath) {
    console.error('Usage: node src/frame-groups.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, frameSceneGroups(readJson(scenePath), readJson(specPath)));
  console.log(outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();
