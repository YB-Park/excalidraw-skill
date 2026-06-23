#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE_STYLES = Object.freeze({
  calls: { strokeColor: '#2563eb', strokeStyle: 'solid', strokeWidth: 2, role: 'runtime-call' },
  sync: { strokeColor: '#2563eb', strokeStyle: 'solid', strokeWidth: 2, role: 'runtime-call' },
  returns: { strokeColor: '#64748b', strokeStyle: 'dashed', strokeWidth: 2, role: 'return' },
  'depends-on': { strokeColor: '#64748b', strokeStyle: 'dashed', strokeWidth: 2, role: 'dependency' },
  references: { strokeColor: '#64748b', strokeStyle: 'dashed', strokeWidth: 2, role: 'dependency' },
  contains: { strokeColor: '#94a3b8', strokeStyle: 'dotted', strokeWidth: 2, role: 'containment' },
  async: { strokeColor: '#7c3aed', strokeStyle: 'dashed', strokeWidth: 2, role: 'async' },
  publishes: { strokeColor: '#7c3aed', strokeStyle: 'dashed', strokeWidth: 2, role: 'async' },
  subscribes: { strokeColor: '#7c3aed', strokeStyle: 'dashed', strokeWidth: 2, role: 'async' },
  reads: { strokeColor: '#0f766e', strokeStyle: 'solid', strokeWidth: 2, role: 'data-read' },
  writes: { strokeColor: '#b45309', strokeStyle: 'solid', strokeWidth: 2, role: 'data-write' },
  transfers: { strokeColor: '#0284c7', strokeStyle: 'solid', strokeWidth: 2, role: 'data-transfer' },
  controls: { strokeColor: '#334155', strokeStyle: 'solid', strokeWidth: 2, role: 'control' },
  interrupts: { strokeColor: '#dc2626', strokeStyle: 'dashed', strokeWidth: 2, role: 'interrupt' },
  retries: { strokeColor: '#d97706', strokeStyle: 'dashed', strokeWidth: 2, role: 'retry' },
  'fails-to': { strokeColor: '#dc2626', strokeStyle: 'dashed', strokeWidth: 2, role: 'failure' },
  optional: { strokeColor: '#64748b', strokeStyle: 'dashed', strokeWidth: 2, role: 'optional' }
});

const EDGE_ROLE_STYLES = Object.freeze({
  default: { strokeColor: '#1f2937', strokeWidth: 2, strokeStyle: 'solid', opacity: 100 },
  'data-plane': { strokeColor: '#2563eb', strokeWidth: 3, strokeStyle: 'solid', opacity: 100 },
  'control-plane': { strokeColor: '#7c3aed', strokeWidth: 2, strokeStyle: 'solid', opacity: 100 },
  'event-stream': { strokeColor: '#0891b2', strokeWidth: 2, strokeStyle: 'dashed', opacity: 100 },
  'error-path': { strokeColor: '#dc2626', strokeWidth: 3, strokeStyle: 'dashed', opacity: 100 },
  dependency: { strokeColor: '#64748b', strokeWidth: 2, strokeStyle: 'solid', opacity: 100 },
  muted: { strokeColor: '#94a3b8', strokeWidth: 1, strokeStyle: 'solid', opacity: 70 }
});

const EDGE_EMPHASIS_STYLES = Object.freeze({
  normal: {},
  strong: { strokeWidthDelta: 1 },
  critical: { strokeColor: '#dc2626', strokeWidth: 4, opacity: 100 },
  muted: { strokeColor: '#94a3b8', strokeWidth: 1, opacity: 70 }
});

const EDGE_STROKES = new Set(['solid', 'dashed', 'dotted']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizeEdgeVisual(visualCandidate) {
  const visual = visualCandidate && typeof visualCandidate === 'object' ? visualCandidate : {};
  return {
    role: EDGE_ROLE_STYLES[visual.role] ? visual.role : 'default',
    emphasis: EDGE_EMPHASIS_STYLES[visual.emphasis] ? visual.emphasis : 'normal',
    stroke: EDGE_STROKES.has(visual.stroke) ? visual.stroke : undefined
  };
}

function edgeVisualStyle(visualCandidate) {
  const visual = normalizeEdgeVisual(visualCandidate);
  const roleStyle = EDGE_ROLE_STYLES[visual.role] ?? EDGE_ROLE_STYLES.default;
  const emphasisStyle = EDGE_EMPHASIS_STYLES[visual.emphasis] ?? EDGE_EMPHASIS_STYLES.normal;
  return {
    visual,
    style: {
      strokeColor: emphasisStyle.strokeColor ?? roleStyle.strokeColor,
      strokeWidth: emphasisStyle.strokeWidth ?? Math.max(1, roleStyle.strokeWidth + (emphasisStyle.strokeWidthDelta ?? 0)),
      strokeStyle: visual.stroke ?? emphasisStyle.strokeStyle ?? roleStyle.strokeStyle,
      opacity: emphasisStyle.opacity ?? roleStyle.opacity
    }
  };
}

function applyStyle(element, style) {
  element.strokeColor = style.strokeColor;
  element.strokeStyle = style.strokeStyle;
  element.strokeWidth = style.strokeWidth;
  if (Number.isFinite(style.opacity)) element.opacity = style.opacity;
}

export function styleEdges(scene) {
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role !== 'edge') continue;

    if (meta.visual) {
      const { visual, style } = edgeVisualStyle(meta.visual);
      applyStyle(element, style);
      meta.visual = visual;
      meta.styleRole = visual.role === 'default' ? 'visual-default' : `visual-${visual.role}`;
      meta.styleSource = 'edge.visual';
      continue;
    }

    const style = EDGE_STYLES[meta.kind];
    if (!style) continue;
    applyStyle(element, style);
    meta.styleRole = style.role;
    meta.styleSource = 'kind';
  }
  return scene;
}

function run() {
  const [scenePath, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePath) {
    console.error('Usage: node src/style-edges.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, styleEdges(readJson(scenePath)));
  console.log(outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();
