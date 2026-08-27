#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatch as applySemanticPatch } from './patch.mjs';
import { routeEdges } from './route-edges.mjs';
import { labelEdges } from './label-edges.mjs';
import { placeEdgeLabels } from './place-edge-labels.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { createQualityReport } from './quality-report.mjs';
import { styleByKind } from './style-by-kind.mjs';
import { styleEdges } from './style-edges.mjs';
import { presetNameForScene } from './style-preset.mjs';

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

function clone(value) {
  return structuredClone(value);
}

function semanticElements(scene, role) {
  return (scene.elements ?? []).filter((element) => metaOf(element).role === role);
}

function bySemanticId(elements) {
  return new Map(elements.map((element) => [metaOf(element).semanticId, element]));
}

function edgeLabelsByEdge(scene) {
  return new Map(semanticElements(scene, 'edge-label').map((label) => [metaOf(label).edge, label]));
}

function affectedIntent(beforeScene, patch) {
  const beforeById = new Map((beforeScene.elements ?? []).map((element) => [metaOf(element).semanticId, element]));
  const changedNodes = new Set();
  const explicitEdges = new Set();

  for (const op of patch.operations ?? []) {
    if (op.op === 'addNode' && op.semanticId) changedNodes.add(op.semanticId);
    if (op.op === 'updateLabel') changedNodes.add(op.target ?? op.semanticId);
    if (op.op === 'moveNear' && op.target) changedNodes.add(op.target);
    if (op.op === 'addEdge') explicitEdges.add(op.semanticId ?? `${op.from}_to_${op.to}`);
    if (op.op === 'insertNodeBetween') {
      const edgeId = op.target ?? op.edge;
      if (op.semanticId) changedNodes.add(op.semanticId);
      if (edgeId) {
        explicitEdges.add(op.inEdgeSemanticId ?? `${edgeId}__in`);
        explicitEdges.add(op.outEdgeSemanticId ?? `${edgeId}__out`);
      }
    }
    if (op.op === 'removeObject') {
      const target = op.target ?? op.semanticId;
      const before = beforeById.get(target);
      if (metaOf(before).role === 'node') changedNodes.add(target);
      if (metaOf(before).role === 'edge') explicitEdges.add(target);
    }
  }

  return { changedNodes, explicitEdges };
}

function copyRouteGeometry(target, source) {
  for (const key of ['x', 'y', 'width', 'height']) target[key] = source[key];
  target.points = clone(source.points ?? []);
  const sourceRoute = metaOf(source).route;
  if (sourceRoute) metaOf(target).route = clone(sourceRoute);
}

function rerouteAffectedEdges(scene, affectedEdges) {
  if (affectedEdges.size === 0) return;
  const routed = clone(scene);
  routeEdges(routed, null);
  const routedById = bySemanticId(semanticElements(routed, 'edge'));
  for (const edge of semanticElements(scene, 'edge')) {
    const semanticId = metaOf(edge).semanticId;
    if (!affectedEdges.has(semanticId)) continue;
    const replacement = routedById.get(semanticId);
    if (replacement) copyRouteGeometry(edge, replacement);
  }
}

function styleAddedElements(scene, beforeNodeIds, beforeEdgeIds) {
  const preset = presetNameForScene(scene);
  const newNodes = semanticElements(scene, 'node').filter((node) => !beforeNodeIds.has(metaOf(node).semanticId));
  const newEdges = semanticElements(scene, 'edge').filter((edge) => !beforeEdgeIds.has(metaOf(edge).semanticId));
  if (newNodes.length > 0) styleByKind({ customData: scene.customData, elements: newNodes }, preset);
  if (newEdges.length > 0) styleEdges({ customData: scene.customData, elements: newEdges }, preset);
  return {
    newNodeIds: new Set(newNodes.map((node) => metaOf(node).semanticId)),
    newEdgeIds: new Set(newEdges.map((edge) => metaOf(edge).semanticId))
  };
}

function placeAffectedEdgeLabels(scene, affectedEdges, beforeLabelEdges) {
  labelEdges(scene);
  const placed = clone(scene);
  placeEdgeLabels(placed, null);
  const placedLabels = edgeLabelsByEdge(placed);
  for (const label of semanticElements(scene, 'edge-label')) {
    const edgeId = metaOf(label).edge;
    const isNewLabel = !beforeLabelEdges.has(edgeId);
    if (!affectedEdges.has(edgeId) && !isNewLabel) continue;
    const replacement = placedLabels.get(edgeId);
    if (!replacement) continue;
    label.x = replacement.x;
    label.y = replacement.y;
    label.backgroundColor = replacement.backgroundColor;
    const placement = metaOf(replacement).placement;
    if (placement) metaOf(label).placement = clone(placement);
  }
}

function compactFailure(editability, quality) {
  return {
    editabilityPass: editability.pass,
    structuralPass: quality.structuralPass,
    editabilityMetrics: editability.metrics,
    structuralMetrics: quality.metrics,
    suggestedPatches: quality.suggestedPatches
  };
}

export function applyQualityPatch(scene, patch, options = {}) {
  const before = clone(scene);
  const beforeNodeIds = new Set(semanticElements(before, 'node').map((node) => metaOf(node).semanticId));
  const beforeEdgeIds = new Set(semanticElements(before, 'edge').map((edge) => metaOf(edge).semanticId));
  const beforeLabelEdges = new Set(edgeLabelsByEdge(before).keys());
  const intent = affectedIntent(before, patch);

  applySemanticPatch(scene, patch);
  const added = styleAddedElements(scene, beforeNodeIds, beforeEdgeIds);
  for (const nodeId of added.newNodeIds) intent.changedNodes.add(nodeId);
  for (const edgeId of added.newEdgeIds) intent.explicitEdges.add(edgeId);

  const affectedEdges = new Set(intent.explicitEdges);
  for (const edge of semanticElements(scene, 'edge')) {
    const meta = metaOf(edge);
    if (intent.changedNodes.has(meta.from) || intent.changedNodes.has(meta.to)) {
      affectedEdges.add(meta.semanticId);
    }
  }

  rerouteAffectedEdges(scene, affectedEdges);
  placeAffectedEdgeLabels(scene, affectedEdges, beforeLabelEdges);

  const editability = createEditabilityReport(scene);
  const quality = createQualityReport(scene);
  const strict = options.strict !== false;
  if (strict && (!editability.pass || !quality.structuralPass)) {
    throw new Error(`Patched scene failed quality gates: ${JSON.stringify(compactFailure(editability, quality))}`);
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.patchQuality = {
    version: '0.1.0',
    affectedEdges: [...affectedEdges].sort(),
    newNodes: [...added.newNodeIds].sort(),
    newEdges: [...added.newEdgeIds].sort(),
    editabilityPass: editability.pass,
    structuralPass: quality.structuralPass
  };
  return scene;
}

function main() {
  const [scenePathArg, patchPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !patchPathArg) {
    console.error('Usage: node src/quality-patch.mjs <scene.excalidraw> <patch.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const patchPath = path.resolve(process.cwd(), patchPathArg);
  const scene = readJson(scenePath);
  const patch = readJson(patchPath);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : path.resolve(process.cwd(), patch.outputPath ?? scenePathArg);
  writeJson(outputPath, applyQualityPatch(scene, patch));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`patch failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
