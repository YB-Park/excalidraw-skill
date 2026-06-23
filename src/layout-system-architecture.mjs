#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULTS = Object.freeze({
  originX: 140,
  originY: 120,
  nodeGap: 70,
  layerGap: 100,
  externalGap: 180,
  frameGap: 48,
  framePad: 48,
  singletonFramePad: 80
});

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

function collectSceneNodes(scene) {
  const nodes = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta?.role === 'node' && typeof meta.semanticId === 'string') {
      nodes.set(meta.semanticId, element);
    }
  }
  return nodes;
}

function collectLabels(scene) {
  const labels = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta?.role !== 'label' || typeof meta.node !== 'string') continue;
    const list = labels.get(meta.node) ?? [];
    list.push(element);
    labels.set(meta.node, list);
  }
  return labels;
}

function declaredLayers(spec) {
  const declared = Array.isArray(spec.architecture?.layers)
    ? spec.architecture.layers
        .filter((layer) => layer && typeof layer.id === 'string')
        .map((layer, index) => ({
          id: layer.id,
          label: layer.label ?? layer.id,
          order: finite(layer.order, index)
        }))
    : [];

  const known = new Set(declared.map((layer) => layer.id));
  for (const node of spec.nodes ?? []) {
    if (typeof node.layer !== 'string' || known.has(node.layer)) continue;
    declared.push({ id: node.layer, label: node.layer, order: declared.length });
    known.add(node.layer);
  }

  if (declared.length === 0) {
    declared.push({ id: 'system', label: 'System', order: 0 });
  }

  return declared.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function isExternalNode(node) {
  const shape = String(node.shapeRef ?? node.kind ?? '').toLowerCase();
  const group = String(node.group ?? '').toLowerCase();
  const role = String(node.hostRole ?? '').toLowerCase();
  return shape.includes('external') || shape.includes('provider') || group.includes('external') || role === 'external';
}

function layerAssignments(spec, layers) {
  const fallbackLayer = layers[Math.max(0, layers.length - 1)].id;
  const byLayer = new Map(layers.map((layer) => [layer.id, []]));
  const external = [];

  (spec.nodes ?? []).forEach((node, index) => {
    const entry = { node, index };
    if (isExternalNode(node) && !node.layer) {
      external.push(entry);
      return;
    }
    const layerId = byLayer.has(node.layer) ? node.layer : fallbackLayer;
    byLayer.get(layerId).push(entry);
  });

  return { byLayer, external };
}

function focusIds(spec) {
  return new Set(Array.isArray(spec.architecture?.focus) ? spec.architecture.focus : []);
}

function orderLayerEntries(entries, focus) {
  return [...entries].sort((a, b) => {
    const aFocus = focus.has(a.node.semanticId) ? 0 : 1;
    const bFocus = focus.has(b.node.semanticId) ? 0 : 1;
    const aRank = finite(a.node.layoutHints?.rank, a.index);
    const bRank = finite(b.node.layoutHints?.rank, b.index);
    return aFocus - bFocus || aRank - bRank || a.index - b.index;
  });
}

function framedGroupIds(spec) {
  const ids = new Set(spec.framePolicy?.include ?? spec.layout?.framePolicy?.include ?? []);
  for (const group of spec.groups ?? []) {
    if (!group || typeof group.id !== 'string') continue;
    if (group.visualBoundary === true || group.frame === true || group.forceFrame === true) ids.add(group.id);
  }
  return ids;
}

function groupMemberCounts(spec) {
  const counts = new Map();
  for (const node of spec.nodes ?? []) {
    if (!node.group) continue;
    counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
  }
  return counts;
}

function rowFramedGroups(entries, framedGroups) {
  return new Set(entries
    .map((entry) => entry.node.group)
    .filter((group) => group && framedGroups.has(group)));
}

function groupsOverlap(first, second) {
  return [...first].some((group) => second.has(group));
}

function framePadForGroup(group, memberCounts) {
  return (memberCounts.get(group) ?? 0) <= 1
    ? DEFAULTS.singletonFramePad
    : DEFAULTS.framePad;
}

function rowFramePad(groups, memberCounts) {
  return Math.max(0, ...[...groups].map((group) => framePadForGroup(group, memberCounts)));
}

function gapAfterRow(entries, nextEntries, framedGroups, memberCounts) {
  if (!nextEntries) return DEFAULTS.layerGap;
  const currentGroups = rowFramedGroups(entries, framedGroups);
  const nextGroups = rowFramedGroups(nextEntries, framedGroups);
  if (currentGroups.size === 0 || nextGroups.size === 0) return DEFAULTS.layerGap;
  if (groupsOverlap(currentGroups, nextGroups)) return DEFAULTS.layerGap;
  return Math.max(
    DEFAULTS.layerGap,
    rowFramePad(currentGroups, memberCounts) + rowFramePad(nextGroups, memberCounts) + DEFAULTS.frameGap
  );
}

function rowWidth(entries, sceneNodes) {
  return entries.reduce((sum, entry, index) => {
    const width = finite(sceneNodes.get(entry.node.semanticId)?.width, 180);
    return sum + width + (index === 0 ? 0 : DEFAULTS.nodeGap);
  }, 0);
}

function maxNodeHeight(entries, sceneNodes) {
  return Math.max(80, ...entries.map((entry) => finite(sceneNodes.get(entry.node.semanticId)?.height, 80)));
}

function setPlacement(placements, id, x, y) {
  placements.set(id, { x: Math.round(x), y: Math.round(y) });
}

function layoutLayeredSystem(spec, sceneNodes) {
  const layers = declaredLayers(spec);
  const focus = focusIds(spec);
  const { byLayer, external } = layerAssignments(spec, layers);
  const framedGroups = framedGroupIds(spec);
  const memberCounts = groupMemberCounts(spec);
  const orderedRows = layers.map((layer) => ({
    layer,
    entries: orderLayerEntries(byLayer.get(layer.id) ?? [], focus)
  }));

  const contentWidth = Math.max(
    180,
    ...orderedRows.map(({ entries }) => rowWidth(entries, sceneNodes))
  );
  const placements = new Map();
  const layerRows = [];
  let y = DEFAULTS.originY;

  for (let index = 0; index < orderedRows.length; index += 1) {
    const { layer, entries } = orderedRows[index];
    const rowHeight = maxNodeHeight(entries, sceneNodes);
    const width = rowWidth(entries, sceneNodes);
    let x = DEFAULTS.originX + (contentWidth - width) / 2;

    for (const entry of entries) {
      const node = sceneNodes.get(entry.node.semanticId);
      if (!node) continue;
      setPlacement(placements, entry.node.semanticId, x, y);
      x += finite(node.width, 180) + DEFAULTS.nodeGap;
    }

    layerRows.push({
      id: layer.id,
      label: layer.label,
      order: layer.order,
      y: Math.round(y),
      height: rowHeight,
      memberIds: entries.map((entry) => entry.node.semanticId)
    });
    const nextEntries = orderedRows[index + 1]?.entries;
    y += rowHeight + gapAfterRow(entries, nextEntries, framedGroups, memberCounts);
  }

  if (external.length > 0) {
    const externalEntries = orderLayerEntries(external, focus);
    let externalY = DEFAULTS.originY;
    const externalX = DEFAULTS.originX + contentWidth + DEFAULTS.externalGap;
    for (const entry of externalEntries) {
      const node = sceneNodes.get(entry.node.semanticId);
      if (!node) continue;
      setPlacement(placements, entry.node.semanticId, externalX, externalY);
      externalY += finite(node.height, 80) + DEFAULTS.nodeGap;
    }
  }

  return { placements, layerRows, focus, externalIds: external.map((entry) => entry.node.semanticId) };
}

function applyPlacements(scene, sceneNodes, labels, result, profile) {
  for (const [id, target] of result.placements) {
    const node = sceneNodes.get(id);
    if (!node) continue;
    const dx = target.x - finite(node.x, 0);
    const dy = target.y - finite(node.y, 0);
    node.x = target.x;
    node.y = target.y;
    const meta = metaOf(node);
    if (meta) meta.architectureFocus = result.focus.has(id);
    for (const label of labels.get(id) ?? []) {
      label.x = finite(label.x, 0) + dx;
      label.y = finite(label.y, 0) + dy;
    }
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layout = {
    engine: 'system-architecture-v0.2.1',
    family: 'system-architecture',
    profile,
    placedNodes: result.placements.size,
    layerRows: result.layerRows,
    externalIds: result.externalIds
  };
}

export function layoutSystemArchitecture(scene, spec) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (!spec || typeof spec !== 'object') throw new TypeError('DiagramSpec JSON must be an object');
  if (spec.diagramType !== 'system-architecture') return scene;

  const profile = spec.layout?.profile ?? 'layered-system';
  if (profile !== 'layered-system') return scene;

  const sceneNodes = collectSceneNodes(scene);
  const labels = collectLabels(scene);
  const result = layoutLayeredSystem(spec, sceneNodes);
  applyPlacements(scene, sceneNodes, labels, result, profile);
  return scene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/layout-system-architecture.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }

  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : scenePath;

  writeJson(outputPath, layoutSystemArchitecture(readJson(scenePath), readJson(specPath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`layout-system-architecture failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
