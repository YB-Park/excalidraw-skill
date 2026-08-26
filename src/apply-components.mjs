#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { componentDetailStyles, presetNameForScene } from './style-preset.mjs';

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

function make(type, id, x, y, width, height, styles) {
  return {
    id,
    type,
    x: numberOr(x, 0),
    y: numberOr(y, 0),
    width: numberOr(width, 0),
    height: numberOr(height, 0),
    angle: 0,
    ...styles.base,
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

function makeText(id, value, x, y, width, styles, size = 11) {
  const text = make('text', id, x, y, width, 18, styles);
  text.text = String(value ?? '');
  text.originalText = text.text;
  text.fontSize = size;
  text.fontFamily = 1;
  text.textAlign = 'left';
  text.verticalAlign = 'middle';
  text.containerId = null;
  text.lineHeight = 1.25;
  text.strokeColor = styles.text.strokeColor;
  return text;
}

function tag(node, value, color, fill, styles, width = 54) {
  const box = make('rectangle', safeId('tag', `${node.id}_${value}`), node.x + 12, node.y + 8, width, 18, styles);
  box.strokeColor = color;
  box.backgroundColor = fill;
  const label = makeText(safeId('tag_text', `${node.id}_${value}`), value, box.x + 8, box.y + 2, width - 8, styles, 10);
  label.strokeColor = color;
  return [box, label];
}

function line(node, name, x1, y1, x2, y2, color, styles) {
  const element = make('line', safeId(name, node.id), x1, y1, x2 - x1, y2 - y1, styles);
  element.points = [[0, 0], [x2 - x1, y2 - y1]];
  element.strokeColor = color;
  return element;
}

function accent(node, color, styles, width = 8) {
  const bar = make('rectangle', safeId('accent', node.id), node.x, node.y, width, node.height, styles);
  bar.strokeColor = color;
  bar.backgroundColor = color;
  return [bar];
}

function database(node, styles) {
  const visual = styles.database;
  return [
    line(node, 'db_top', node.x + 14, node.y + 22, node.x + node.width - 14, node.y + 22, visual.strokeColor, styles),
    line(node, 'db_bottom', node.x + 14, node.y + node.height - 18, node.x + node.width - 14, node.y + node.height - 18, visual.strokeColor, styles),
    ...tag(node, 'DATA', visual.strokeColor, visual.tagFill, styles)
  ];
}

function queue(node, styles) {
  const visual = styles.queue;
  const band = make('rectangle', safeId('queue_band', node.id), node.x, node.y, node.width, 24, styles);
  band.strokeColor = visual.strokeColor;
  band.backgroundColor = visual.bandFill;
  const label = makeText(safeId('queue_label', node.id), 'EVENT', node.x + 12, node.y + 4, 60, styles, 10);
  label.strokeColor = visual.labelStroke;
  const dots = [0, 1, 2].map((index) => {
    const dot = make('ellipse', safeId(`queue_dot_${index}`, node.id), node.x + node.width - 44 + index * 14, node.y + 8, 8, 8, styles);
    dot.strokeColor = visual.strokeColor;
    dot.backgroundColor = visual.strokeColor;
    return dot;
  });
  return [band, label, ...dots];
}

function external(node, styles) {
  const visual = styles.external;
  const shell = make('rectangle', safeId('external_shell', node.id), node.x - 6, node.y - 6, node.width + 12, node.height + 12, styles);
  shell.strokeColor = visual.strokeColor;
  shell.strokeStyle = 'dashed';
  return [shell, ...tag(node, 'EXT', visual.strokeColor, visual.tagFill, styles)];
}

function risk(node, styles) {
  const visual = styles.risk;
  const badge = make('ellipse', safeId('risk_badge', node.id), node.x + node.width - 34, node.y + 8, 22, 22, styles);
  badge.strokeColor = visual.strokeColor;
  badge.backgroundColor = visual.badgeFill;
  const bang = makeText(safeId('risk_bang', node.id), '!', badge.x + 8, badge.y + 1, 12, styles, 15);
  bang.strokeColor = visual.textStroke;
  return [...accent(node, visual.strokeColor, styles, 10), badge, bang];
}

function worker(node, styles) {
  const visual = styles.worker;
  return [...accent(node, visual.strokeColor, styles), ...tag(node, 'JOB', visual.strokeColor, visual.tagFill, styles, 48)];
}

function state(node, styles) {
  const visual = styles.state;
  return [
    ...tag(node, 'STATE', visual.strokeColor, visual.tagFill, styles, 64),
    line(node, 'state_mid', node.x + 14, node.y + node.height - 20, node.x + node.width - 14, node.y + node.height - 20, visual.separator, styles)
  ];
}

function entity(node, styles) {
  const visual = styles.entity;
  return [
    ...tag(node, 'ENTITY', visual.strokeColor, visual.tagFill, styles, 70),
    line(node, 'entity_row_1', node.x + 14, node.y + 32, node.x + node.width - 14, node.y + 32, visual.separator, styles),
    line(node, 'entity_row_2', node.x + 14, node.y + 52, node.x + node.width - 14, node.y + 52, visual.separator, styles)
  ];
}

function processTask(node, styles) {
  const visual = styles.process;
  return [...tag(node, 'TASK', visual.strokeColor, visual.tagFill, styles, 56), ...accent(node, visual.accent, styles, 6)];
}

function decision(node, styles) {
  const visual = styles.process;
  const marker = make('rectangle', safeId('decision_mark', node.id), node.x + node.width - 31, node.y + 11, 18, 18, styles);
  marker.angle = Math.PI / 4;
  marker.strokeColor = visual.strokeColor;
  marker.backgroundColor = visual.tagFill;
  return [...tag(node, 'DECIDE', visual.strokeColor, visual.tagFill, styles, 72), marker];
}

function sequence(node, styles) {
  const visual = styles.sequence;
  return [
    ...tag(node, 'SEQ', visual.strokeColor, visual.tagFill, styles, 48),
    line(node, 'lifeline', node.x + node.width / 2, node.y + node.height, node.x + node.width / 2, node.y + node.height + 90, visual.lifeline, styles)
  ];
}

function deployment(node, styles) {
  const visual = styles.deployment;
  const shell = make('rectangle', safeId('deploy_shell', node.id), node.x - 8, node.y - 8, node.width + 16, node.height + 16, styles);
  shell.strokeColor = visual.strokeColor;
  shell.strokeStyle = 'dashed';
  return [shell, ...tag(node, 'RUN', visual.tagStroke, visual.tagFill, styles, 48)];
}

function details(node, styles) {
  const ref = String(node.customData?.excalidrawSkill?.shapeRef ?? '');
  if (ref.includes('database') || ref.includes('storage')) return database(node, styles);
  if (ref.includes('queue')) return queue(node, styles);
  if (ref.includes('external')) return external(node, styles);
  if (ref.includes('risk') || ref.includes('security')) return risk(node, styles);
  if (ref.includes('worker')) return worker(node, styles);
  if (ref.includes('state')) return state(node, styles);
  if (ref.includes('domain')) return entity(node, styles);
  if (ref.includes('process.decision')) return decision(node, styles);
  if (ref.includes('process')) return processTask(node, styles);
  if (ref.includes('sequence')) return sequence(node, styles);
  if (ref.includes('cloud') || ref.includes('network') || ref.includes('k8s') || ref.includes('runtime')) return deployment(node, styles);
  if (ref.includes('gateway')) return [
    ...accent(node, styles.gateway.strokeColor, styles),
    ...tag(node, 'API', styles.gateway.strokeColor, styles.gateway.tagFill, styles)
  ];
  if (ref.includes('client') || ref.includes('actor')) return accent(node, styles.actor.strokeColor, styles);
  return accent(node, styles.service.strokeColor, styles);
}

function run() {
  const scenePath = requirePath(scenePathArg, 'scenePath');
  const outputPath = flag === '-o' ? requirePath(outputPathArg, 'outputPath') : scenePath;
  const scene = readJson(scenePath);

  if (!scene || typeof scene !== 'object') {
    throw new TypeError('Scene JSON must be an object');
  }

  const styles = componentDetailStyles(presetNameForScene(scene));
  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  const existing = new Set(elements.map((element) => element?.id).filter(Boolean));
  const additions = [];

  for (const element of elements) {
    const meta = element?.customData?.excalidrawSkill;
    if (meta?.role !== 'node' || !validNode(element)) continue;

    const generated = details(element, styles);
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
