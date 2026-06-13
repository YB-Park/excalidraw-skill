#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);

function requirePath(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty path string`);
  }
  return path.resolve(process.cwd(), value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function safeId(prefix, value) {
  return `${String(prefix)}_${String(value ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function validNode(node) {
  return Boolean(
    node &&
    typeof node === 'object' &&
    typeof node.id === 'string' &&
    Number.isFinite(node.x) &&
    Number.isFinite(node.y) &&
    Number.isFinite(node.width) &&
    Number.isFinite(node.height)
  );
}

function make(type, id, x, y, width, height) {
  return {
    id,
    type,
    x: numberOr(x, 0),
    y: numberOr(y, 0),
    width: numberOr(width, 0),
    height: numberOr(height, 0),
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

function makeText(id, value, x, y, width, size = 11) {
  const text = make('text', id, x, y, width, 18);
  text.text = String(value ?? '');
  text.originalText = text.text;
  text.fontSize = size;
  text.fontFamily = 1;
  text.textAlign = 'left';
  text.verticalAlign = 'middle';
  text.containerId = null;
  text.lineHeight = 1.25;
  text.strokeColor = '#475569';
  return text;
}

function tag(node, value, color, fill, width = 54) {
  const box = make('rectangle', safeId('tag', `${node.id}_${value}`), node.x + 12, node.y + 8, width, 18);
  box.strokeColor = color;
  box.backgroundColor = fill;
  const label = makeText(safeId('tag_text', `${node.id}_${value}`), value, box.x + 8, box.y + 2, width - 8, 10);
  label.strokeColor = color;
  return [box, label];
}

function line(node, name, x1, y1, x2, y2, color) {
  const element = make('line', safeId(name, node.id), x1, y1, x2 - x1, y2 - y1);
  element.points = [[0, 0], [x2 - x1, y2 - y1]];
  element.strokeColor = color;
  return element;
}

function accent(node, color, width = 8) {
  const bar = make('rectangle', safeId('accent', node.id), node.x, node.y, width, node.height);
  bar.strokeColor = color;
  bar.backgroundColor = color;
  return [bar];
}

function database(node) {
  return [
    line(node, 'db_top', node.x + 14, node.y + 22, node.x + node.width - 14, node.y + 22, '#0f766e'),
    line(node, 'db_bottom', node.x + 14, node.y + node.height - 18, node.x + node.width - 14, node.y + node.height - 18, '#0f766e'),
    ...tag(node, 'DATA', '#0f766e', '#ccfbf1')
  ];
}

function queue(node) {
  const band = make('rectangle', safeId('queue_band', node.id), node.x, node.y, node.width, 24);
  band.strokeColor = '#9333ea';
  band.backgroundColor = '#f3e8ff';
  const label = makeText(safeId('queue_label', node.id), 'EVENT', node.x + 12, node.y + 4, 60, 10);
  label.strokeColor = '#7e22ce';
  const dots = [0, 1, 2].map((index) => {
    const dot = make('ellipse', safeId(`queue_dot_${index}`, node.id), node.x + node.width - 44 + index * 14, node.y + 8, 8, 8);
    dot.strokeColor = '#9333ea';
    dot.backgroundColor = '#9333ea';
    return dot;
  });
  return [band, label, ...dots];
}

function external(node) {
  const shell = make('rectangle', safeId('external_shell', node.id), node.x - 6, node.y - 6, node.width + 12, node.height + 12);
  shell.strokeColor = '#64748b';
  shell.strokeStyle = 'dashed';
  return [shell, ...tag(node, 'EXT', '#64748b', '#f1f5f9')];
}

function risk(node) {
  const badge = make('ellipse', safeId('risk_badge', node.id), node.x + node.width - 34, node.y + 8, 22, 22);
  badge.strokeColor = '#d97706';
  badge.backgroundColor = '#fef3c7';
  const bang = makeText(safeId('risk_bang', node.id), '!', badge.x + 8, badge.y + 1, 12, 15);
  bang.strokeColor = '#b45309';
  return [...accent(node, '#d97706', 10), badge, bang];
}

function worker(node) {
  return [...accent(node, '#7c3aed'), ...tag(node, 'JOB', '#7c3aed', '#ede9fe', 48)];
}

function state(node) {
  return [...tag(node, 'STATE', '#334155', '#f1f5f9', 64), line(node, 'state_mid', node.x + 14, node.y + node.height - 20, node.x + node.width - 14, node.y + node.height - 20, '#94a3b8')];
}

function entity(node) {
  return [...tag(node, 'ENTITY', '#334155', '#f8fafc', 70), line(node, 'entity_row_1', node.x + 14, node.y + 32, node.x + node.width - 14, node.y + 32, '#cbd5e1'), line(node, 'entity_row_2', node.x + 14, node.y + 52, node.x + node.width - 14, node.y + 52, '#cbd5e1')];
}

function processTask(node) {
  return [...tag(node, 'TASK', '#475569', '#f8fafc', 56), ...accent(node, '#64748b', 6)];
}

function decision(node) {
  const marker = make('rectangle', safeId('decision_mark', node.id), node.x + node.width - 31, node.y + 11, 18, 18);
  marker.angle = Math.PI / 4;
  marker.strokeColor = '#475569';
  marker.backgroundColor = '#f8fafc';
  return [...tag(node, 'DECIDE', '#475569', '#f8fafc', 72), marker];
}

function sequence(node) {
  return [...tag(node, 'SEQ', '#2563eb', '#dbeafe', 48), line(node, 'lifeline', node.x + node.width / 2, node.y + node.height, node.x + node.width / 2, node.y + node.height + 90, '#94a3b8')];
}

function deployment(node) {
  const shell = make('rectangle', safeId('deploy_shell', node.id), node.x - 8, node.y - 8, node.width + 16, node.height + 16);
  shell.strokeColor = '#94a3b8';
  shell.strokeStyle = 'dashed';
  return [shell, ...tag(node, 'RUN', '#64748b', '#f1f5f9', 48)];
}

function details(node) {
  const ref = String(node.customData?.excalidrawSkill?.shapeRef ?? '');
  if (ref.includes('database') || ref.includes('storage')) return database(node);
  if (ref.includes('queue')) return queue(node);
  if (ref.includes('external')) return external(node);
  if (ref.includes('risk') || ref.includes('security')) return risk(node);
  if (ref.includes('worker')) return worker(node);
  if (ref.includes('state')) return state(node);
  if (ref.includes('domain')) return entity(node);
  if (ref.includes('process.decision')) return decision(node);
  if (ref.includes('process')) return processTask(node);
  if (ref.includes('sequence')) return sequence(node);
  if (ref.includes('cloud') || ref.includes('network') || ref.includes('k8s') || ref.includes('runtime')) return deployment(node);
  if (ref.includes('gateway')) return [...accent(node, '#2563eb'), ...tag(node, 'API', '#2563eb', '#dbeafe')];
  if (ref.includes('client') || ref.includes('actor')) return accent(node, '#475569');
  return accent(node, '#4f46e5');
}

function run() {
  const scenePath = requirePath(scenePathArg, 'scenePath');
  const outputPath = flag === '-o' ? requirePath(outputPathArg, 'outputPath') : scenePath;
  const scene = readJson(scenePath);

  if (!scene || typeof scene !== 'object') {
    throw new TypeError('Scene JSON must be an object');
  }

  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  const existing = new Set(elements.map((element) => element?.id).filter(Boolean));
  const additions = [];

  for (const element of elements) {
    const meta = element?.customData?.excalidrawSkill;
    if (meta?.role !== 'node' || !validNode(element)) continue;

    const generated = details(element);
    if (!Array.isArray(generated)) continue;

    for (const detail of generated) {
      if (!detail || typeof detail.id !== 'string' || existing.has(detail.id)) continue;
      additions.push(detail);
      existing.add(detail.id);
    }
  }

  scene.elements = [...additions, ...elements];
  writeJson(outputPath, scene);
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

try {
  run();
} catch (error) {
  console.error(`apply-components failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
