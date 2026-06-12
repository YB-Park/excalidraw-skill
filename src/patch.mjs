#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [scenePath, patchPath, flag, outputPathArg] = process.argv.slice(2);

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

function base(type, semanticId) {
  return {
    id: safeId(type, semanticId),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: '#1f2937',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0.7,
    opacity: 100,
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

function nodeText(node, rect) {
  const text = base('text', `${node.semanticId}_label`);
  text.x = rect.x + 16;
  text.y = rect.y + 26;
  text.width = rect.width - 32;
  text.height = 28;
  text.backgroundColor = 'transparent';
  text.text = node.label ?? node.semanticId;
  text.originalText = text.text;
  text.fontSize = 18;
  text.fontFamily = 1;
  text.textAlign = 'center';
  text.verticalAlign = 'middle';
  text.containerId = null;
  text.lineHeight = 1.25;
  text.customData.excalidrawSkill.role = 'label';
  text.customData.excalidrawSkill.node = node.semanticId;
  return text;
}

function overlapsAny(rect, nodeMap) {
  for (const other of nodeMap.values()) {
    const separated =
      rect.x + rect.width < other.x ||
      other.x + other.width < rect.x ||
      rect.y + rect.height < other.y ||
      other.y + other.height < rect.y;
    if (!separated) return true;
  }
  return false;
}

function choosePosition(near, nodeMap, fallbackIndex) {
  if (!near) return { x: 100 + fallbackIndex * 260, y: 120 };

  const candidates = [
    { x: near.x + near.width + 100, y: near.y },
    { x: near.x, y: near.y + near.height + 120 },
    { x: near.x + near.width + 100, y: near.y + near.height + 120 },
    { x: near.x, y: near.y - near.height - 120 }
  ];

  for (const candidate of candidates) {
    const probe = { ...candidate, width: 180, height: 80 };
    if (!overlapsAny(probe, nodeMap)) return candidate;
  }

  return { x: near.x, y: near.y + near.height + 120 };
}

function addNode(elements, nodeMap, op) {
  const rect = base('rectangle', op.semanticId);
  const near = nodeMap.get(op.near);
  const position = choosePosition(near, nodeMap, nodeMap.size);
  rect.x = position.x;
  rect.y = position.y;
  rect.width = 180;
  rect.height = 80;
  rect.customData.excalidrawSkill.role = 'node';
  rect.customData.excalidrawSkill.label = op.label;
  rect.customData.excalidrawSkill.shapeRef = op.shapeRef ?? 'service.backend';
  nodeMap.set(op.semanticId, rect);
  elements.push(rect, nodeText(op, rect));
}

function addEdge(elements, nodeMap, op) {
  const from = nodeMap.get(op.from);
  const to = nodeMap.get(op.to);
  if (!from || !to) return;
  const semanticId = op.semanticId ?? `${op.from}_to_${op.to}`;
  const arrow = base('arrow', semanticId);
  arrow.x = from.x + from.width;
  arrow.y = from.y + from.height / 2;
  arrow.width = to.x - arrow.x;
  arrow.height = to.y + to.height / 2 - arrow.y;
  arrow.points = [[0, 0], [arrow.width, arrow.height]];
  arrow.startBinding = null;
  arrow.endBinding = null;
  arrow.startArrowhead = null;
  arrow.endArrowhead = 'arrow';
  arrow.customData.excalidrawSkill.role = 'edge';
  arrow.customData.excalidrawSkill.from = op.from;
  arrow.customData.excalidrawSkill.to = op.to;
  arrow.customData.excalidrawSkill.label = op.label ?? '';
  arrow.customData.excalidrawSkill.kind = op.kind ?? 'sync';
  elements.push(arrow);
}

function updateLabel(elements, op) {
  for (const element of elements) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'node' && meta.semanticId === op.target) meta.label = op.label;
    if (meta?.role === 'label' && meta.node === op.target) {
      element.text = op.label;
      element.originalText = op.label;
    }
  }
}

function run() {
  if (!scenePath || !patchPath) {
    console.error('Usage: node src/patch.mjs <scene.excalidraw> <patch.json> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const patch = readJson(patchPath);
  const elements = scene.elements ?? [];
  const nodeMap = new Map();

  for (const element of elements) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'node') nodeMap.set(meta.semanticId, element);
  }

  for (const op of patch.operations ?? []) {
    if (op.op === 'addNode') addNode(elements, nodeMap, op);
    if (op.op === 'addEdge') addEdge(elements, nodeMap, op);
    if (op.op === 'updateLabel') updateLabel(elements, op);
  }

  scene.elements = elements;
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : patch.outputPath ?? scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

run();
