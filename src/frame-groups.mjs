#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAME_PADDING = 48;
const SINGLETON_FRAME_PADDING = 80;
const MIN_FRAME_GAP = 16;
const FRAME_TITLE_HEIGHT = 32;
const FRAME_TITLE_CHAR_WIDTH = 7.5;
const FRAME_TITLE_PADDING_X = 24;
const FRAME_TITLE_MIN_WIDTH = 64;
const FRAME_TITLE_MAX_WIDTH = 360;

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
      force: group.forceFrame === true,
      singletonBoundary: group.singletonBoundary === true,
      boundaryIntent: typeof group.boundaryIntent === 'string' ? group.boundaryIntent : null
    });
  }
  return definitions;
}

function paddingForFrame(boxes) {
  return boxes.length <= 1 ? SINGLETON_FRAME_PADDING : FRAME_PADDING;
}

function titleMetrics(frame) {
  const label = String(frame.name ?? '').trim();
  if (!label) return { width: 0, height: 0 };
  return {
    width: Math.max(
      FRAME_TITLE_MIN_WIDTH,
      Math.min(FRAME_TITLE_MAX_WIDTH, label.length * FRAME_TITLE_CHAR_WIDTH + FRAME_TITLE_PADDING_X)
    ),
    height: FRAME_TITLE_HEIGHT
  };
}

function memberBounds(boxes) {
  return {
    left: Math.min(...boxes.map((box) => box.x)),
    top: Math.min(...boxes.map((box) => box.y)),
    right: Math.max(...boxes.map((box) => box.x + box.width)),
    bottom: Math.max(...boxes.map((box) => box.y + box.height))
  };
}

function frameRect(frame) {
  return {
    left: frame.x,
    top: frame.y,
    right: frame.x + frame.width,
    bottom: frame.y + frame.height
  };
}

function frameVisualRect(frame) {
  const rect = frameRect(frame);
  const title = titleMetrics(frame);
  return {
    left: rect.left,
    top: rect.top - title.height,
    right: Math.max(rect.right, rect.left + title.width),
    bottom: rect.bottom
  };
}

function rectsCollide(first, second, gap = 0) {
  return first.left < second.right + gap
    && first.right + gap > second.left
    && first.top < second.bottom + gap
    && first.bottom + gap > second.top;
}

function setFrameLeft(frame, left) {
  const right = frame.x + frame.width;
  frame.x = left;
  frame.width = Math.max(1, right - left);
}

function setFrameTop(frame, top) {
  const bottom = frame.y + frame.height;
  frame.y = top;
  frame.height = Math.max(1, bottom - top);
}

function setFrameRight(frame, right) {
  frame.width = Math.max(1, right - frame.x);
}

function setFrameBottom(frame, bottom) {
  frame.height = Math.max(1, bottom - frame.y);
}

function separateHorizontal(leftItem, rightItem) {
  const available = rightItem.member.left - leftItem.member.right;
  if (available < MIN_FRAME_GAP) return false;
  const splitLeft = leftItem.member.right + (available - MIN_FRAME_GAP) / 2;
  const splitRight = splitLeft + MIN_FRAME_GAP;
  setFrameRight(leftItem.frame, Math.min(frameRect(leftItem.frame).right, splitLeft));
  setFrameLeft(rightItem.frame, Math.max(frameRect(rightItem.frame).left, splitRight));
  return true;
}

function separateVertical(topItem, bottomItem) {
  const requiredGap = MIN_FRAME_GAP + titleMetrics(bottomItem.frame).height;
  const available = bottomItem.member.top - topItem.member.bottom;
  if (available < requiredGap) return false;
  const splitTop = topItem.member.bottom + (available - requiredGap) / 2;
  const splitBottom = splitTop + requiredGap;
  setFrameBottom(topItem.frame, Math.min(frameRect(topItem.frame).bottom, splitTop));
  setFrameTop(bottomItem.frame, Math.max(frameRect(bottomItem.frame).top, splitBottom));
  return true;
}

function resolveFramePair(first, second) {
  if (first.mode !== 'explicit' || second.mode !== 'explicit') return 'ignored';
  if (!rectsCollide(frameVisualRect(first.frame), frameVisualRect(second.frame), MIN_FRAME_GAP)) return 'clear';

  const options = [];
  if (first.member.right <= second.member.left) {
    options.push({ available: second.member.left - first.member.right, apply: () => separateHorizontal(first, second) });
  } else if (second.member.right <= first.member.left) {
    options.push({ available: first.member.left - second.member.right, apply: () => separateHorizontal(second, first) });
  }
  if (first.member.bottom <= second.member.top) {
    options.push({ available: second.member.top - first.member.bottom, apply: () => separateVertical(first, second) });
  } else if (second.member.bottom <= first.member.top) {
    options.push({ available: first.member.top - second.member.bottom, apply: () => separateVertical(second, first) });
  }

  const option = options
    .filter((candidate) => candidate.available >= MIN_FRAME_GAP)
    .sort((a, b) => b.available - a.available)[0];
  return option?.apply() ? 'adjusted' : 'unresolved';
}

function resolveFrameCollisions(items) {
  let adjusted = 0;
  let unresolved = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    unresolved = 0;
    for (let index = 0; index < items.length; index += 1) {
      for (let next = index + 1; next < items.length; next += 1) {
        const result = resolveFramePair(items[index], items[next]);
        if (result === 'adjusted') {
          adjusted += 1;
          changed = true;
        } else if (result === 'unresolved') {
          unresolved += 1;
        }
      }
    }
    if (!changed) break;
  }
  return { adjusted, unresolved };
}

function makeFrame(groupName, label, boxes, mode, definition = {}) {
  const pad = paddingForFrame(boxes);
  const bounds = memberBounds(boxes);
  const left = bounds.left - pad;
  const top = bounds.top - pad;
  const right = bounds.right + pad;
  const bottom = bounds.bottom + pad;

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
        padding: pad,
        singletonBoundary: definition?.singletonBoundary === true,
        boundaryIntent: definition?.boundaryIntent ?? null,
        titleReserve: label ? {
          mode: 'native-100pct-estimate',
          height: FRAME_TITLE_HEIGHT,
          width: titleMetrics({ name: label }).width
        } : null
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

    const explicit = preferredGroups.has(groupName) || definition?.visualBoundary === true || definition?.singletonBoundary === true;
    if (explicitMode && !explicit) {
      suppressedUnspecifiedGroups += 1;
      continue;
    }
    if (boxes.length < minimumMembers && !definition?.force && !(boxes.length === 1 && definition?.singletonBoundary === true)) {
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
      definition,
      mode: explicit ? 'explicit' : 'auto'
    });
  }

  candidates.sort((a, b) => {
    const explicitDelta = (b.mode === 'explicit' ? 1 : 0) - (a.mode === 'explicit' ? 1 : 0);
    return explicitDelta || b.boxes.length - a.boxes.length || a.groupName.localeCompare(b.groupName);
  });

  const selected = candidates.slice(0, budget);
  const frameItems = selected.map(({ groupName, label, boxes, mode, definition }) => ({
    frame: makeFrame(groupName, label, boxes, mode, definition),
    member: memberBounds(boxes),
    mode
  }));
  const collisionPolicy = resolveFrameCollisions(frameItems);
  const frames = frameItems.map((item) => item.frame);

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
          titleReserveMode: 'native-100pct-estimate',
          titleReserveHeight: FRAME_TITLE_HEIGHT,
          adjustedFrameCollisions: collisionPolicy.adjusted,
          unresolvedFrameCollisions: collisionPolicy.unresolved,
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
