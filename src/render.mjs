#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fitNodeLabel } from './text-fit.mjs';
import {
  DEFAULT_STYLE_PRESET,
  baseElementStyle,
  edgeVisualStyleFor,
  loadStylePreset
} from './style-preset.mjs';

const [specPath, flag, outputPathArg] = process.argv.slice(2);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`); }
function safeId(prefix, value) { return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_')}`; }
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

function addLabel(elements, node, rect, fit, preset) {
  const text = base('text', `${node.semanticId}_label`, preset);
  text.width = rect.width - 32;
  text.height = Math.ceil(fit.lineCount * fit.fontSize * fit.lineHeight);
  text.x = rect.x + 16;
  text.y = rect.y + (rect.height - text.height) / 2;
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
  text.customData.excalidrawSkill.node = node.semanticId;
  text.customData.excalidrawSkill.sourceLabel = fit.originalLabel;
  text.customData.excalidrawSkill.textFit = { sizeClass: fit.sizeClass, lineCount: fit.lineCount, overflow: fit.overflow, estimatedLineWidths: fit.estimatedLineWidths };
  addBoundElement(rect, text.id, 'text');
  elements.push(text);
}

function applyEdgeVisual(arrow, edge, preset) {
  const { visual, style } = edgeVisualStyleFor(edge.visual, preset);
  arrow.strokeColor = style.strokeColor;
  arrow.strokeWidth = style.strokeWidth;
  arrow.strokeStyle = style.strokeStyle;
  arrow.opacity = style.opacity;
  arrow.customData.excalidrawSkill.visual = visual;
}

export function renderSpec(spec) {
  const presetName = spec.stylePreset ?? DEFAULT_STYLE_PRESET;
  const preset = loadStylePreset(presetName);
  const elements = [];
  const rects = new Map();
  for (const [index, node] of (spec.nodes ?? []).entries()) {
    const fit = fitNodeLabel(node.label ?? node.semanticId);
    const rect = base('rectangle', node.semanticId, preset);
    rect.x = 100 + index * 300;
    rect.y = 120;
    rect.width = fit.width;
    rect.height = fit.height;
    rect.customData.excalidrawSkill.role = 'node';
    rect.customData.excalidrawSkill.label = node.label;
    rect.customData.excalidrawSkill.displayLabel = fit.text;
    rect.customData.excalidrawSkill.shapeRef = node.shapeRef ?? node.kind ?? 'service.backend';
    rect.customData.excalidrawSkill.textFit = { sizeClass: fit.sizeClass, lineCount: fit.lineCount, overflow: fit.overflow };
    rects.set(node.semanticId, rect);
    elements.push(rect);
    addLabel(elements, node, rect, fit, preset);
  }

  for (const edge of spec.edges ?? []) {
    const from = rects.get(edge.from);
    const to = rects.get(edge.to);
    if (!from || !to) continue;
    const semanticId = edge.semanticId ?? `${edge.from}_to_${edge.to}`;
    const arrow = base('arrow', semanticId, preset);
    arrow.x = from.x + from.width;
    arrow.y = from.y + from.height / 2;
    arrow.width = to.x - arrow.x;
    arrow.height = to.y + to.height / 2 - arrow.y;
    arrow.points = [[0, 0], [arrow.width, arrow.height]];
    arrow.startBinding = { elementId: from.id, focus: 0, gap: 0 };
    arrow.endBinding = { elementId: to.id, focus: 0, gap: 0 };
    arrow.startArrowhead = null;
    arrow.endArrowhead = 'arrow';
    arrow.customData.excalidrawSkill.role = 'edge';
    arrow.customData.excalidrawSkill.from = edge.from;
    arrow.customData.excalidrawSkill.to = edge.to;
    arrow.customData.excalidrawSkill.label = edge.label ?? '';
    arrow.customData.excalidrawSkill.kind = edge.kind ?? 'sync';
    applyEdgeVisual(arrow, edge, preset);
    addBoundElement(from, arrow.id, 'arrow');
    addBoundElement(to, arrow.id, 'arrow');
    elements.push(arrow);
  }

  return {
    type: 'excalidraw',
    version: 2,
    source: 'excalidraw-skill',
    elements,
    appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
    files: {},
    customData: {
      excalidrawSkill: {
        diagramType: spec.diagramType ?? null,
        title: spec.title ?? null,
        stylePreset: spec.stylePreset ?? null
      }
    }
  };
}

function run() {
  if (!specPath) {
    console.error('Usage: node src/render.mjs <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const spec = readJson(specPath);
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : spec.outputPath ?? 'diagram.excalidraw';
  writeJson(outputPath, renderSpec(spec));
  console.log(outputPath);
}

if (process.argv[1]?.endsWith('render.mjs')) run();
