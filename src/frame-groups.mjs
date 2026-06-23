#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAME_PADDING = 48;
const SINGLETON_FRAME_PADDING = 80;

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

function frameBudget(nodeCount, policy = {}, explicitMode = false) {
  if (Number.isInteger(policy.maxFrames) && policy.maxFrames >= 0) return policy.maxFrames;
  if (policy.mode === 'none') return 0;
  if (explicitMode) return 2;
  if (nodeCount <= 4) return 0;
  if (nodeCount <= 8) return 1;
  return 2;
}

function groupDefinitions(spec) {
  const definitions = new Map();
  for (const group of Array.isArray(spec.groups) ? spec.groups : []) {
    if (!group || typeof group.id !== 'string') continue;
    definitions.set(group.id, {
      label: group.label ?? group.id,
      visualBoundary: group.visualBoundary === true || group.frame === true,
      disabled: group.visualBoundary === false || group.frame === false,
      force: group.forceFrame === true
    });
  }
  return definitions;
}

function paddingForFrame(boxes) {
  return boxes.length <= 1 ? SINGLETON_FRAME_PADDING : FRAME_PADDING;
}

function makeFrame(groupName, label, boxes, mode) {
  const pad = paddingForFrame(boxes);
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
    name: label,
    customData: {
      excalidrawSkill: {
        semanticId: groupName,
        role: 'frame',
        generatedBy: 'frame-groups',
        memberCount: boxes.length,
        frameMode: mode,
        padding: pad
      }
    }
  };
}

export function frameSceneGroups(scene, spec) {
  const groups = new Map();
  const nodeGroups = new Map();
  const policy = spec.framePolicy ?? spec.layout?.framePolicy ?? {};
  const definitions = groupDefinitions(spec);
  const explicitMode = definitions.size > 0 || policy.mode === 'explicit' || Array.isArray(policy.include);
  const allowSingletons = policy.allowSingletons === true;
  const allowFullScene = policy.allowFullScene === true;
  const preferredGroups = new Set(policy.include ?? []);
  const excludedGroups = new Set(policy.exclude ?? []);

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

  const defaultMinimum = allowSingletons ? 1 : explicitMode ? 2 : 3;
  const minimumMembers = Number.isInteger(policy.minMembers) && policy.minMembers > 0
    ? policy.minMembers
    : defaultMinimum;
  const budget = frameBudget(sceneNodes.length, policy, explicitMode);

  let suppressedSmallGroups = 0;
  let suppressedUnspecifiedGroups = 0;
  let suppressedFullScene = 0;
  const candidates = [];

  for (const [groupName, boxes] of groups.entries()) {
    if (existingFrames.has(groupName) || excludedGroups.has(groupName)) continue;
    const definition = definitions.get(groupName);
    if (definition?.disabled) continue;

    const explicit = preferredGroups.has(groupName) || definition?.visualBoundary === true;
    if (explicitMode && !explicit) {
      suppressedUnspecifiedGroups += 1;
      continue;
    }
    if (boxes.length < minimumMembers && !definition?.force) {
      suppressedSmallGroups += 1;
      continue;
    }

    const meaningfulFullSceneBoundary = allowFullScene || explicit || definition?.force === true;
    if (boxes.length >= sceneNodes.length && !meaningfulFullSceneBoundary) {
      suppressedFullScene += 1;
      continue;
    }

    candidates.push({
      groupName,
      label: definition?.label ?? groupName,
      boxes,
      mode: explicit ? 'explicit' : 'auto'
    });
  }

  candidates.sort((a, b) => {
    const explicitDelta = (b.mode === 'explicit' ? 1 : 0) - (a.mode === 'explicit' ? 1 : 0);
    return explicitDelta || b.boxes.length - a.boxes.length || a.groupName.localeCompare(b.groupName);
  });

  const selected = candidates.slice(0, budget);
  const frames = selected.map(({ groupName, label, boxes, mode }) => makeFrame(groupName, label, boxes, mode));

  return {
    ...scene,
    elements: [...frames, ...(scene.elements ?? [])],
    customData: {
      ...(scene.customData ?? {}),
      excalidrawSkill: {
        ...(scene.customData?.excalidrawSkill ?? {}),
        framePolicy: {
          budget,
          candidateCount: candidates.length,
          renderedCount: frames.length,
          suppressedSmallGroups,
          suppressedUnspecifiedGroups,
          suppressedFullScene,
          suppressedByBudget: Math.max(0, candidates.length - frames.length)
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
