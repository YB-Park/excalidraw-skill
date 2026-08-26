#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitNodeLabel } from './text-fit.mjs';
import { styleByKind } from './style-by-kind.mjs';
import { styleEdges } from './style-edges.mjs';
import {
  baseElementStyle,
  loadStylePreset,
  presetNameForScene
} from './style-preset.mjs';

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

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function base(type, semanticId, preset) {
  const style = baseElementStyle(preset);
  return {
    id: safeId(type, semanticId),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: style.strokeColor,
    backgroundColor: style.backgroundColor,
    fillStyle: style.fillStyle,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    roughness: style.roughness,
    opacity: style.opacity,
    groupIds: [],
    frameId: null,
    roundness: type === 'rectangle' ? { type: 3 } : null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    customData: { excalidrawSkill: { semanticId } }
  };
}

function addBoundElement(container, id, type) {
  const current = Array.isArray(container.boundElements) ? container.boundElements : [];
  if (!current.some((item) => item?.id === id && item?.type === type)) current.push({ id, type });
  container.boundElements = current;
}

function nodeMap(elements) {
  return new Map(elements
    .filter((element) => metaOf(element).role === 'node')
    .map((element) => [metaOf(element).semanticId, element]));
}

function nodeLabel(elements, semanticId) {
  return elements.find((element) => metaOf(element).role === 'label' && metaOf(element).node === semanticId) ?? null;
}

function semanticElement(elements, semanticId) {
  return elements.find((element) => metaOf(element).semanticId === semanticId) ?? null;
}

function overlapsAny(rect, nodes, ignoreId = null) {
  for (const [id, other] of nodes.entries()) {
    if (id === ignoreId) continue;
    const separated =
      rect.x + rect.width < other.x ||
      other.x + other.width < rect.x ||
      rect.y + rect.height < other.y ||
      other.y + other.height < rect.y;
    if (!separated) return true;
  }
  return false;
}

function choosePosition(near, nodes, fallbackIndex, side = 'right', gap = 100) {
  if (!near) return { x: 100 + fallbackIndex * 260, y: 120 };

  const candidatesBySide = {
    right: [
      { x: near.x + near.width + gap, y: near.y },
      { x: near.x + near.width + gap, y: near.y + near.height + gap }
    ],
    left: [
      { x: near.x - 180 - gap, y: near.y },
      { x: near.x - 180 - gap, y: near.y + near.height + gap }
    ],
    down: [
      { x: near.x, y: near.y + near.height + gap },
      { x: near.x + near.width + gap, y: near.y + near.height + gap }
    ],
    up: [
      { x: near.x, y: near.y - 80 - gap },
      { x: near.x + near.width + gap, y: near.y - 80 - gap }
    ]
  };
  const candidates = candidatesBySide[side] ?? candidatesBySide.right;
  for (const candidate of candidates) {
    const probe = { ...candidate, width: 180, height: 80 };
    if (!overlapsAny(probe, nodes)) return candidate;
  }
  return candidates[0];
}

function createNode(op, position, preset) {
  const fit = fitNodeLabel(op.label ?? op.semanticId);
  const rect = base('rectangle', op.semanticId, preset);
  rect.x = position.x;
  rect.y = position.y;
  rect.width = fit.width;
  rect.height = fit.height;
  rect.customData.excalidrawSkill.role = 'node';
  rect.customData.excalidrawSkill.label = op.label ?? op.semanticId;
  rect.customData.excalidrawSkill.displayLabel = fit.text;
  rect.customData.excalidrawSkill.shapeRef = op.shapeRef ?? 'service.backend';
  rect.customData.excalidrawSkill.textFit = { sizeClass: fit.sizeClass, lineCount: fit.lineCount, overflow: fit.overflow };

  const text = base('text', `${op.semanticId}_label`, preset);
  text.x = rect.x + 16;
  text.y = rect.y + (rect.height - Math.ceil(fit.lineCount * fit.fontSize * fit.lineHeight)) / 2;
  text.width = rect.width - 32;
  text.height = Math.ceil(fit.lineCount * fit.fontSize * fit.lineHeight);
  text.backgroundColor = 'transparent';
  text.text = fit.text;
  text.originalText = fit.text;
  text.fontSize = fit.fontSize;
  text.fontFamily = 1;
  text.textAlign = 'center';
  text.verticalAlign = 'middle';
  text.containerId = rect.id;
  text.lineHeight = fit.lineHeight;
  text.customData.excalidrawSkill.role = 'label';
  text.customData.excalidrawSkill.node = op.semanticId;
  text.customData.excalidrawSkill.sourceLabel = op.label ?? op.semanticId;
  addBoundElement(rect, text.id, 'text');
  return [rect, text];
}

function bindArrow(arrow, from, to) {
  arrow.x = from.x + from.width;
  arrow.y = from.y + from.height / 2;
  arrow.width = to.x - arrow.x;
  arrow.height = to.y + to.height / 2 - arrow.y;
  arrow.points = [[0, 0], [arrow.width, arrow.height]];
  arrow.startBinding = { elementId: from.id, focus: 0, gap: 0 };
  arrow.endBinding = { elementId: to.id, focus: 0, gap: 0 };
  addBoundElement(from, arrow.id, 'arrow');
  addBoundElement(to, arrow.id, 'arrow');
}

function createEdge(nodes, op, preset) {
  const from = nodes.get(op.from);
  const to = nodes.get(op.to);
  if (!from || !to) throw new Error(`Cannot add edge ${op.semanticId ?? ''}: missing endpoint`);
  const semanticId = op.semanticId ?? `${op.from}_to_${op.to}`;
  const arrow = base('arrow', semanticId, preset);
  bindArrow(arrow, from, to);
  arrow.startArrowhead = null;
  arrow.endArrowhead = 'arrow';
  arrow.customData.excalidrawSkill.role = 'edge';
  arrow.customData.excalidrawSkill.from = op.from;
  arrow.customData.excalidrawSkill.to = op.to;
  arrow.customData.excalidrawSkill.label = op.label ?? '';
  arrow.customData.excalidrawSkill.kind = op.kind ?? 'sync';
  return arrow;
}

function addNode(elements, nodes, op, preset) {
  if (!op.semanticId) throw new Error('addNode requires semanticId');
  if (nodes.has(op.semanticId)) throw new Error(`Node already exists: ${op.semanticId}`);
  const near = nodes.get(op.near);
  const position = op.position && Number.isFinite(op.position.x) && Number.isFinite(op.position.y)
    ? op.position
    : choosePosition(near, nodes, nodes.size, op.side ?? 'right', Number(op.gap ?? 100));
  const [rect, text] = createNode(op, position, preset);
  nodes.set(op.semanticId, rect);
  elements.push(rect, text);
  return rect;
}

function addEdge(elements, nodes, op, preset) {
  const arrow = createEdge(nodes, op, preset);
  elements.push(arrow);
  return arrow;
}

function updateLabel(elements, nodes, op) {
  const target = op.target ?? op.semanticId;
  const node = nodes.get(target);
  const label = nodeLabel(elements, target);
  if (!node || !label) throw new Error(`Cannot update label for missing node: ${target}`);
  const fit = fitNodeLabel(op.label ?? target);
  node.width = Math.max(node.width, fit.width);
  node.height = Math.max(node.height, fit.height);
  node.customData.excalidrawSkill.label = op.label;
  node.customData.excalidrawSkill.displayLabel = fit.text;
  label.text = fit.text;
  label.originalText = fit.text;
  label.width = node.width - 32;
  label.height = Math.ceil(fit.lineCount * fit.fontSize * fit.lineHeight);
  label.x = node.x + 16;
  label.y = node.y + (node.height - label.height) / 2;
  label.fontSize = fit.fontSize;
  label.lineHeight = fit.lineHeight;
  label.customData.excalidrawSkill.sourceLabel = op.label;
}

function refreshConnectedEdges(elements, nodes, semanticId) {
  for (const element of elements) {
    const meta = metaOf(element);
    if (meta.role !== 'edge') continue;
    if (meta.from !== semanticId && meta.to !== semanticId) continue;
    const from = nodes.get(meta.from);
    const to = nodes.get(meta.to);
    if (from && to) bindArrow(element, from, to);
  }
}

function moveNode(elements, nodes, semanticId, position) {
  const node = nodes.get(semanticId);
  if (!node) throw new Error(`Cannot move missing node: ${semanticId}`);
  const dx = position.x - node.x;
  const dy = position.y - node.y;
  const groupIds = new Set(node.groupIds ?? []);

  for (const element of elements) {
    const meta = metaOf(element);
    const sameNodeLabel = meta.role === 'label' && meta.node === semanticId;
    const sameGroup = (element.groupIds ?? []).some((id) => groupIds.has(id));
    if (element === node || sameNodeLabel || sameGroup) {
      element.x = Number(element.x ?? 0) + dx;
      element.y = Number(element.y ?? 0) + dy;
    }
  }
  node.customData.excalidrawSkill.manualLayout = true;
  refreshConnectedEdges(elements, nodes, semanticId);
}

function moveNear(elements, nodes, op) {
  const targetId = op.target;
  const near = nodes.get(op.near);
  const target = nodes.get(targetId);
  if (!target || !near) throw new Error('moveNear requires existing target and near nodes');
  const gap = Number(op.gap ?? 100);
  const side = op.side ?? 'right';
  let position;
  if (side === 'left') position = { x: near.x - target.width - gap, y: near.y };
  else if (side === 'up') position = { x: near.x, y: near.y - target.height - gap };
  else if (side === 'down') position = { x: near.x, y: near.y + near.height + gap };
  else position = { x: near.x + near.width + gap, y: near.y };
  moveNode(elements, nodes, targetId, position);
}

function removeSemanticObject(elements, semanticId) {
  const target = semanticElement(elements, semanticId);
  if (!target) throw new Error(`Cannot remove missing object: ${semanticId}`);
  const meta = metaOf(target);
  const removeIds = new Set([target.id]);
  const removeSemanticEdges = new Set();
  const targetGroups = new Set(target.groupIds ?? []);

  if (meta.role === 'node') {
    for (const element of elements) {
      const itemMeta = metaOf(element);
      if (itemMeta.role === 'label' && itemMeta.node === semanticId) removeIds.add(element.id);
      if (itemMeta.role === 'edge' && (itemMeta.from === semanticId || itemMeta.to === semanticId)) {
        removeIds.add(element.id);
        removeSemanticEdges.add(itemMeta.semanticId);
      }
      if ((element.groupIds ?? []).some((id) => targetGroups.has(id))) removeIds.add(element.id);
    }
  } else if (meta.role === 'edge') {
    removeSemanticEdges.add(meta.semanticId);
  }

  for (const element of elements) {
    const itemMeta = metaOf(element);
    if (itemMeta.role === 'edge-label' && removeSemanticEdges.has(itemMeta.edge)) removeIds.add(element.id);
  }

  const filtered = elements.filter((element) => !removeIds.has(element.id));
  for (const element of filtered) {
    if (Array.isArray(element.boundElements)) {
      element.boundElements = element.boundElements.filter((item) => !removeIds.has(item.id));
      if (element.boundElements.length === 0) element.boundElements = null;
    }
  }
  return filtered;
}

function insertNodeBetween(elements, nodes, op, preset) {
  const edgeId = op.target ?? op.edge;
  const edge = semanticElement(elements, edgeId);
  if (!edge || metaOf(edge).role !== 'edge') throw new Error(`insertNodeBetween requires an existing edge: ${edgeId}`);
  if (!op.semanticId) throw new Error('insertNodeBetween requires semanticId for the new node');
  const edgeMeta = metaOf(edge);
  const from = nodes.get(edgeMeta.from);
  const to = nodes.get(edgeMeta.to);
  if (!from || !to) throw new Error(`Cannot insert into edge with missing endpoint: ${edgeId}`);

  const position = {
    x: Math.round((from.x + from.width + to.x - 180) / 2),
    y: Math.round((from.y + to.y) / 2)
  };
  const nextElements = removeSemanticObject(elements, edgeId);
  elements.splice(0, elements.length, ...nextElements);
  const newNode = addNode(elements, nodes, { ...op, position }, preset);
  nodes.set(op.semanticId, newNode);
  addEdge(elements, nodes, {
    semanticId: op.inEdgeSemanticId ?? `${edgeId}__in`,
    from: edgeMeta.from,
    to: op.semanticId,
    label: op.inLabel ?? edgeMeta.label ?? '',
    kind: op.inKind ?? edgeMeta.kind ?? 'sync'
  }, preset);
  addEdge(elements, nodes, {
    semanticId: op.outEdgeSemanticId ?? `${edgeId}__out`,
    from: op.semanticId,
    to: edgeMeta.to,
    label: op.outLabel ?? '',
    kind: op.outKind ?? edgeMeta.kind ?? 'sync'
  }, preset);
}

function groupIntoFrame(elements, nodes, op, preset) {
  const members = Array.isArray(op.members) && op.members.length > 0
    ? op.members
    : [op.target].filter(Boolean);
  const memberNodes = members.map((id) => nodes.get(id)).filter(Boolean);
  if (memberNodes.length !== members.length || memberNodes.length === 0) throw new Error('groupIntoFrame requires existing member nodes');
  const semanticId = op.semanticId ?? `frame_${members.join('_')}`;
  const padding = Number(op.padding ?? 48);
  const left = Math.min(...memberNodes.map((node) => node.x)) - padding;
  const top = Math.min(...memberNodes.map((node) => node.y)) - padding;
  const right = Math.max(...memberNodes.map((node) => node.x + node.width)) + padding;
  const bottom = Math.max(...memberNodes.map((node) => node.y + node.height)) + padding;
  const frame = base('frame', semanticId, preset);
  frame.x = left;
  frame.y = top;
  frame.width = right - left;
  frame.height = bottom - top;
  frame.roundness = null;
  frame.name = op.label ?? semanticId;
  frame.strokeColor = '#9ca3af';
  frame.backgroundColor = '#f8fafc';
  frame.strokeWidth = 1;
  frame.customData.excalidrawSkill.role = 'frame';
  frame.customData.excalidrawSkill.memberCount = members.length;
  frame.customData.excalidrawSkill.boundaryIntent = op.boundaryIntent ?? null;

  const memberSet = new Set(members);
  for (const element of elements) {
    const meta = metaOf(element);
    if ((meta.role === 'node' && memberSet.has(meta.semanticId)) || (meta.role === 'label' && memberSet.has(meta.node))) {
      element.frameId = frame.id;
    }
  }
  elements.unshift(frame);
}

function applyStylePreset(scene, elements, op) {
  const preset = op.preset ?? op.stylePreset ?? 'professional-software';
  loadStylePreset(preset);
  const workingScene = { ...scene, elements };
  styleByKind(workingScene, preset);
  styleEdges(workingScene, preset);
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.stylePreset = preset;
  return preset;
}

export function applyPatch(scene, patch) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (!patch || typeof patch !== 'object') throw new TypeError('DiagramPatch JSON must be an object');
  const elements = Array.isArray(scene.elements) ? [...scene.elements] : [];
  const nodes = nodeMap(elements);
  let currentPreset = presetNameForScene(scene);
  loadStylePreset(currentPreset);
  const supported = new Set([
    'addNode',
    'addEdge',
    'updateLabel',
    'moveNear',
    'insertNodeBetween',
    'groupIntoFrame',
    'applyStylePreset',
    'removeObject'
  ]);

  for (const op of patch.operations ?? []) {
    if (!supported.has(op.op)) throw new Error(`Unsupported patch operation: ${op.op}`);
    if (op.op === 'addNode') addNode(elements, nodes, op, currentPreset);
    if (op.op === 'addEdge') addEdge(elements, nodes, op, currentPreset);
    if (op.op === 'updateLabel') updateLabel(elements, nodes, op);
    if (op.op === 'moveNear') moveNear(elements, nodes, op);
    if (op.op === 'insertNodeBetween') insertNodeBetween(elements, nodes, op, currentPreset);
    if (op.op === 'groupIntoFrame') groupIntoFrame(elements, nodes, op, currentPreset);
    if (op.op === 'applyStylePreset') currentPreset = applyStylePreset(scene, elements, op);
    if (op.op === 'removeObject') {
      const next = removeSemanticObject(elements, op.target ?? op.semanticId);
      elements.splice(0, elements.length, ...next);
      nodes.clear();
      for (const [id, node] of nodeMap(elements)) nodes.set(id, node);
    }
  }

  scene.elements = elements;
  return scene;
}

function main() {
  const [scenePath, patchPath, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePath || !patchPath) {
    console.error('Usage: node src/patch.mjs <scene.excalidraw> <patch.json> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const patch = readJson(patchPath);
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : patch.outputPath ?? scenePath;
  writeJson(outputPath, applyPatch(scene, patch));
  console.log(outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`patch failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
