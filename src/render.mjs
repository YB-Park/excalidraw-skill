#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [specPath, flag, outputPathArg] = process.argv.slice(2);

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

function addLabel(elements, node, rect) {
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
  elements.push(text);
}

function run() {
  if (!specPath) {
    console.error('Usage: node src/render.mjs <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }

  const spec = readJson(specPath);
  const elements = [];
  const rects = new Map();

  for (const [index, node] of (spec.nodes ?? []).entries()) {
    const rect = base('rectangle', node.semanticId);
    rect.x = 100 + index * 260;
    rect.y = 120;
    rect.width = 180;
    rect.height = 80;
    rect.customData.excalidrawSkill.role = 'node';
    rect.customData.excalidrawSkill.label = node.label;
    rect.customData.excalidrawSkill.shapeRef = node.shapeRef ?? node.kind ?? 'service.backend';
    rects.set(node.semanticId, rect);
    elements.push(rect);
    addLabel(elements, node, rect);
  }

  for (const edge of spec.edges ?? []) {
    const from = rects.get(edge.from);
    const to = rects.get(edge.to);
    if (!from || !to) continue;
    const semanticId = edge.semanticId ?? `${edge.from}_to_${edge.to}`;
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
    arrow.customData.excalidrawSkill.from = edge.from;
    arrow.customData.excalidrawSkill.to = edge.to;
    arrow.customData.excalidrawSkill.label = edge.label ?? '';
    arrow.customData.excalidrawSkill.kind = edge.kind ?? 'sync';
    elements.push(arrow);
  }

  const scene = {
    type: 'excalidraw',
    version: 2,
    source: 'excalidraw-skill',
    elements,
    appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
    files: {}
  };

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : spec.outputPath ?? 'diagram.excalidraw';
  writeJson(outputPath, scene);
  console.log(outputPath);
}

run();
