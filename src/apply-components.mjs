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

function makeElement(type, id, x, y, width, height) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#64748b',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
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
    customData: { excalidrawSkill: { role: 'component-detail' } }
  };
}

function addText(target, text, x, y, width) {
  const element = makeElement('text', safeId('component_text', `${target.id}_${text}`), x, y, width, 18);
  element.text = text;
  element.originalText = text;
  element.fontSize = 12;
  element.fontFamily = 1;
  element.textAlign = 'left';
  element.verticalAlign = 'middle';
  element.containerId = null;
  element.lineHeight = 1.25;
  element.strokeColor = '#475569';
  return element;
}

function addAccent(node, color) {
  const bar = makeElement('rectangle', safeId('accent', node.id), node.x, node.y, 8, node.height);
  bar.strokeColor = color;
  bar.backgroundColor = color;
  bar.customData.excalidrawSkill.node = node.customData?.excalidrawSkill?.semanticId;
  return [bar];
}

function addDatabase(node) {
  const line = makeElement('line', safeId('db_line', node.id), node.x + 16, node.y + 24, node.width - 32, 0);
  line.points = [[0, 0], [node.width - 32, 0]];
  line.strokeColor = '#0f766e';
  line.customData.excalidrawSkill.node = node.customData?.excalidrawSkill?.semanticId;
  return [line, addText(node, 'DATA', node.x + 16, node.y + 8, 60)];
}

function addQueue(node) {
  const dot1 = makeElement('ellipse', safeId('queue_dot_1', node.id), node.x + node.width - 42, node.y + 14, 8, 8);
  const dot2 = makeElement('ellipse', safeId('queue_dot_2', node.id), node.x + node.width - 28, node.y + 14, 8, 8);
  const dot3 = makeElement('ellipse', safeId('queue_dot_3', node.id), node.x + node.width - 14, node.y + 14, 8, 8);
  for (const dot of [dot1, dot2, dot3]) {
    dot.strokeColor = '#9333ea';
    dot.backgroundColor = '#9333ea';
    dot.customData.excalidrawSkill.node = node.customData?.excalidrawSkill?.semanticId;
  }
  return [dot1, dot2, dot3];
}

function componentDetails(node) {
  const shapeRef = node.customData?.excalidrawSkill?.shapeRef ?? '';
  if (shapeRef.includes('database') || shapeRef.includes('storage')) return addDatabase(node);
  if (shapeRef.includes('queue')) return addQueue(node);
  if (shapeRef.includes('external')) return addAccent(node, '#64748b');
  if (shapeRef.includes('risk') || shapeRef.includes('security')) return addAccent(node, '#d97706');
  if (shapeRef.includes('gateway')) return addAccent(node, '#2563eb');
  if (shapeRef.includes('worker')) return addAccent(node, '#7c3aed');
  if (shapeRef.includes('client') || shapeRef.includes('actor')) return addAccent(node, '#475569');
  return addAccent(node, '#4f46e5');
}

function run() {
  if (!scenePath) {
    console.error('Usage: node src/apply-components.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = readJson(scenePath);
  const additions = [];
  const existing = new Set((scene.elements ?? []).map((element) => element.id));

  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'node') continue;
    for (const detail of componentDetails(element)) {
      if (!existing.has(detail.id)) additions.push(detail);
    }
  }

  scene.elements = [...additions, ...(scene.elements ?? [])];
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

run();
