#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SIDE_GAP = 70;
const COLLISION_PAD = 24;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function rectAt(node, x) {
  return {
    x: x - COLLISION_PAD,
    y: node.y - COLLISION_PAD,
    width: node.width + COLLISION_PAD * 2,
    height: node.height + COLLISION_PAD * 2
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function layerOrders(spec) {
  const result = new Map();
  for (const [index, layer] of (spec.architecture?.layers ?? []).entries()) {
    if (!layer || typeof layer.id !== 'string') continue;
    result.set(layer.id, Number.isFinite(layer.order) ? layer.order : index);
  }
  return result;
}

function nodeSpecs(spec) {
  return new Map((spec.nodes ?? []).map((node) => [node.semanticId, node]));
}

function degreeByNode(spec) {
  const degree = new Map((spec.nodes ?? []).map((node) => [node.semanticId, 0]));
  for (const edge of spec.edges ?? []) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return degree;
}

function layerCounts(spec) {
  const counts = new Map();
  for (const node of spec.nodes ?? []) {
    if (typeof node.layer !== 'string') continue;
    counts.set(node.layer, (counts.get(node.layer) ?? 0) + 1);
  }
  return counts;
}

function bypassingEdges(spec, nodeSpec, orders, specs) {
  const order = orders.get(nodeSpec.layer);
  if (!Number.isFinite(order)) return [];
  return (spec.edges ?? []).filter((edge) => {
    const fromLayer = specs.get(edge.from)?.layer;
    const toLayer = specs.get(edge.to)?.layer;
    const fromOrder = orders.get(fromLayer);
    const toOrder = orders.get(toLayer);
    if (!Number.isFinite(fromOrder) || !Number.isFinite(toOrder)) return false;
    const low = Math.min(fromOrder, toOrder);
    const high = Math.max(fromOrder, toOrder);
    return low < order && order < high;
  });
}

function collisionCount(node, nextX, allNodes) {
  const candidate = rectAt(node, nextX);
  let count = 0;
  for (const other of allNodes) {
    if (other === node) continue;
    if (overlaps(candidate, rectAt(other, other.x))) count += 1;
  }
  return count;
}

function chooseOffset(node, allNodes) {
  const distance = node.width + SIDE_GAP;
  const options = [
    { direction: 'right', dx: distance, collisions: collisionCount(node, node.x + distance, allNodes) },
    { direction: 'left', dx: -distance, collisions: collisionCount(node, node.x - distance, allNodes) }
  ];
  return options.sort((a, b) => a.collisions - b.collisions || (a.direction === 'right' ? -1 : 1))[0];
}

export function refineSystemSpine(scene, spec) {
  if (spec?.diagramType !== 'system-architecture' || (spec.layout?.profile ?? 'layered-system') !== 'layered-system') return scene;

  const nodes = new Map();
  const labels = new Map();
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && typeof meta.semanticId === 'string') nodes.set(meta.semanticId, element);
    if (meta.role === 'label' && typeof meta.node === 'string') {
      const list = labels.get(meta.node) ?? [];
      list.push(element);
      labels.set(meta.node, list);
    }
  }

  const orders = layerOrders(spec);
  const specs = nodeSpecs(spec);
  const degree = degreeByNode(spec);
  const counts = layerCounts(spec);
  const allNodes = [...nodes.values()];
  const decisions = [];

  for (const nodeSpec of spec.nodes ?? []) {
    if (!nodeSpec?.semanticId || !nodeSpec.layer) continue;
    if ((degree.get(nodeSpec.semanticId) ?? 0) !== 0) continue;
    if ((counts.get(nodeSpec.layer) ?? 0) !== 1) continue;
    if (nodeSpec.group) continue;
    const bypasses = bypassingEdges(spec, nodeSpec, orders, specs);
    if (bypasses.length === 0) continue;
    const node = nodes.get(nodeSpec.semanticId);
    if (!node) continue;

    const choice = chooseOffset(node, allNodes);
    const previousX = node.x;
    node.x += choice.dx;
    for (const label of labels.get(nodeSpec.semanticId) ?? []) label.x += choice.dx;
    const meta = metaOf(node);
    meta.systemSpineOffset = {
      engine: 'system-spine-v0.1',
      reason: 'disconnected-bypassed-layer',
      direction: choice.direction,
      dx: choice.dx,
      bypassEdges: bypasses.map((edge) => edge.semanticId ?? `${edge.from}_to_${edge.to}`)
    };
    decisions.push({
      node: nodeSpec.semanticId,
      layer: nodeSpec.layer,
      previousX,
      x: node.x,
      direction: choice.direction,
      bypassEdges: meta.systemSpineOffset.bypassEdges
    });
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.systemSpineRefinement = {
    version: '0.1.0',
    moved: decisions.length,
    decisions
  };
  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) {
    console.error('Usage: node src/refine-system-spine.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  const result = refineSystemSpine(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, result);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    refinement: result.customData?.excalidrawSkill?.systemSpineRefinement ?? null
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`refine-system-spine failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
