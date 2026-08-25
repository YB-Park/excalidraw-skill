#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? null;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function collect(scene) {
  const nodes = new Map();
  const labels = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta?.role === 'node' && typeof meta.semanticId === 'string') {
      nodes.set(meta.semanticId, element);
    }
    if (meta?.role === 'label' && typeof meta.node === 'string') {
      const list = labels.get(meta.node) ?? [];
      list.push(element);
      labels.set(meta.node, list);
    }
  }
  return { nodes, labels };
}

function isOutside(node, focusModule) {
  if (focusModule && node.group === focusModule) return false;
  const shape = String(node.shapeRef ?? node.kind ?? '').toLowerCase();
  const group = String(node.group ?? '').toLowerCase();
  return shape.includes('client') || shape.includes('external') || group.includes('external');
}

function applyMove(node, labels, x, y) {
  const dx = x - finite(node.x, 0);
  const dy = y - finite(node.y, 0);
  node.x = Math.round(x);
  node.y = Math.round(y);
  for (const label of labels) {
    label.x = finite(label.x, 0) + dx;
    label.y = finite(label.y, 0) + dy;
  }
}

function internalDegree(spec, internalIds) {
  const degree = new Map([...internalIds].map((id) => [id, 0]));
  for (const edge of spec.edges ?? []) {
    if (!internalIds.has(edge.from) || !internalIds.has(edge.to)) continue;
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return degree;
}

function dominantHub(spec, inside) {
  if (inside.length < 4 || inside.length > 8) return null;
  const ids = new Set(inside.map(({ node }) => node.semanticId));
  const degree = internalDegree(spec, ids);
  const ranked = inside
    .map((entry) => ({ ...entry, degree: degree.get(entry.node.semanticId) ?? 0 }))
    .sort((a, b) => b.degree - a.degree || a.index - b.index);
  const top = ranked[0];
  const second = ranked[1]?.degree ?? 0;
  const threshold = Math.max(3, Math.ceil((inside.length - 1) * 0.6));
  if (!top || top.degree < threshold || top.degree < second + 2) return null;
  return { semanticId: top.node.semanticId, degree: top.degree, degreeById: degree };
}

function rightExternalPressure(spec, internalIds, outsideById) {
  const pressure = new Map([...internalIds].map((id) => [id, 0]));
  for (const edge of spec.edges ?? []) {
    let internalId = null;
    let outsideId = null;
    if (internalIds.has(edge.from) && outsideById.has(edge.to)) {
      internalId = edge.from;
      outsideId = edge.to;
    } else if (internalIds.has(edge.to) && outsideById.has(edge.from)) {
      internalId = edge.to;
      outsideId = edge.from;
    }
    if (!internalId || !outsideId) continue;
    const outside = outsideById.get(outsideId)?.node;
    if (outside?.layoutHints?.lane === 'right') {
      pressure.set(internalId, (pressure.get(internalId) ?? 0) + 1);
    }
  }
  return pressure;
}

function placeCompactGrid(inside, nodes, labels, geometry) {
  const { nodeWidth, nodeHeight, originX, originY, gapX, gapY } = geometry;
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, inside.length))));
  inside.forEach(({ node }, index) => {
    const element = nodes.get(node.semanticId);
    if (!element) return;
    const column = index % columns;
    const row = Math.floor(index / columns);
    applyMove(element, labels.get(node.semanticId) ?? [], originX + column * (nodeWidth + gapX), originY + row * (nodeHeight + gapY));
  });
  const rows = Math.max(1, Math.ceil(inside.length / columns));
  return {
    strategy: 'compact-grid',
    hubId: null,
    columns,
    rows,
    boundaryWidth: columns * nodeWidth + Math.max(0, columns - 1) * gapX,
    boundaryHeight: rows * nodeHeight + Math.max(0, rows - 1) * gapY
  };
}

function hubSlots(rows, hubRow) {
  const slots = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      if (column === 0 && row === hubRow) continue;
      const verticalDistance = Math.abs(row - hubRow);
      let priority = verticalDistance * 20 + column * 6;
      if (column === 1 && row === hubRow) priority = -100;
      else if (column === 0 && verticalDistance === 1) priority -= 12;
      slots.push({ row, column, priority });
    }
  }
  return slots.sort((a, b) => a.priority - b.priority || a.row - b.row || a.column - b.column);
}

function placeHubGrid(inside, outside, spec, hub, nodes, labels, geometry) {
  const { nodeWidth, nodeHeight, originX, originY, gapX, gapY } = geometry;
  const rows = Math.max(2, Math.ceil(inside.length / 2));
  const hubRow = Math.floor((rows - 1) / 2);
  const pitchX = nodeWidth + gapX;
  const pitchY = nodeHeight + gapY;
  const hubElement = nodes.get(hub.semanticId);
  if (hubElement) applyMove(hubElement, labels.get(hub.semanticId) ?? [], originX, originY + hubRow * pitchY);

  const internalIds = new Set(inside.map(({ node }) => node.semanticId));
  const outsideById = new Map(outside.map((entry) => [entry.node.semanticId, entry]));
  const pressure = rightExternalPressure(spec, internalIds, outsideById);
  const satellites = inside
    .filter(({ node }) => node.semanticId !== hub.semanticId)
    .map((entry) => ({
      ...entry,
      degree: hub.degreeById.get(entry.node.semanticId) ?? 0,
      rightPressure: pressure.get(entry.node.semanticId) ?? 0
    }))
    .sort((a, b) => b.rightPressure - a.rightPressure || b.degree - a.degree || a.index - b.index);
  const slots = hubSlots(rows, hubRow);

  satellites.forEach(({ node }, index) => {
    const element = nodes.get(node.semanticId);
    const slot = slots[index];
    if (!element || !slot) return;
    applyMove(element, labels.get(node.semanticId) ?? [], originX + slot.column * pitchX, originY + slot.row * pitchY);
  });

  return {
    strategy: 'hub-grid',
    hubId: hub.semanticId,
    columns: 2,
    rows,
    hubRow,
    boundaryWidth: 2 * nodeWidth + gapX,
    boundaryHeight: rows * nodeHeight + Math.max(0, rows - 1) * gapY
  };
}

function connectedInternalAnchor(outsideId, spec, internalIds) {
  for (const edge of spec.edges ?? []) {
    if (edge.from === outsideId && internalIds.has(edge.to)) return edge.to;
    if (edge.to === outsideId && internalIds.has(edge.from)) return edge.from;
  }
  return null;
}

function externalY(entry, spec, internalIds, nodes, originY, nodeHeight, gapY, usedByLane, lane) {
  const anchorId = connectedInternalAnchor(entry.node.semanticId, spec, internalIds);
  const anchor = anchorId ? nodes.get(anchorId) : null;
  const element = nodes.get(entry.node.semanticId);
  let y = anchor
    ? anchor.y + (finite(anchor.height, nodeHeight) - finite(element?.height, nodeHeight)) / 2
    : originY + entry.index * (nodeHeight + gapY);
  const used = usedByLane.get(lane) ?? [];
  const minimumGap = nodeHeight + 30;
  while (used.some((value) => Math.abs(value - y) < minimumGap)) y += minimumGap;
  used.push(y);
  usedByLane.set(lane, used);
  return y;
}

export function layoutModuleArchitecture(scene, spec) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (!spec || typeof spec !== 'object') throw new TypeError('DiagramSpec JSON must be an object');
  if (spec.diagramType !== 'module-architecture') return scene;
  const profile = spec.layout?.profile ?? 'component-view';
  if (profile !== 'component-view') return scene;

  const { nodes, labels } = collect(scene);
  const focusModule = spec.module?.focusModule ?? 'focus-module';
  const inside = [];
  const outside = [];

  (spec.nodes ?? []).forEach((node, index) => {
    const entry = { node, index };
    if (isOutside(node, focusModule)) outside.push(entry);
    else inside.push(entry);
  });

  const nodeWidth = Math.max(180, ...inside.map(({ node }) => finite(nodes.get(node.semanticId)?.width, 180)));
  const nodeHeight = Math.max(80, ...inside.map(({ node }) => finite(nodes.get(node.semanticId)?.height, 80)));
  const geometry = {
    nodeWidth,
    nodeHeight,
    originX: 380,
    originY: 180,
    gapX: 90,
    gapY: 90
  };

  const hub = dominantHub(spec, inside);
  const placed = hub
    ? placeHubGrid(inside, outside, spec, hub, nodes, labels, geometry)
    : placeCompactGrid(inside, nodes, labels, geometry);

  inside.forEach(({ node }) => {
    const element = nodes.get(node.semanticId);
    const meta = metaOf(element);
    if (meta) {
      meta.moduleScope = 'internal';
      meta.moduleBoundary = focusModule;
    }
  });

  const internalIds = new Set(inside.map(({ node }) => node.semanticId));
  const usedByLane = new Map();
  outside.forEach((entry) => {
    const element = nodes.get(entry.node.semanticId);
    if (!element) return;
    const lane = entry.node.layoutHints?.lane === 'right' ? 'right' : 'left';
    const x = lane === 'right'
      ? geometry.originX + placed.boundaryWidth + 220
      : geometry.originX - nodeWidth - 220;
    const y = externalY(entry, spec, internalIds, nodes, geometry.originY, nodeHeight, geometry.gapY, usedByLane, lane);
    applyMove(element, labels.get(entry.node.semanticId) ?? [], x, y);
    const meta = metaOf(element);
    if (meta) meta.moduleScope = 'external';
  });

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layout = {
    engine: 'module-architecture-v0.2',
    family: 'module-architecture',
    profile,
    focusModule,
    strategy: placed.strategy,
    hubId: placed.hubId,
    internalIds: inside.map(({ node }) => node.semanticId),
    externalIds: outside.map(({ node }) => node.semanticId),
    boundary: {
      x: geometry.originX - 60,
      y: geometry.originY - 60,
      width: placed.boundaryWidth + 120,
      height: placed.boundaryHeight + 120
    }
  };

  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) {
    console.error('Usage: node src/layout-module-architecture.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  writeJson(outputPath, layoutModuleArchitecture(readJson(scenePath), readJson(specPath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
