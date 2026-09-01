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

function rectFor(node, margin = 0) {
  return {
    x: node.x - margin,
    y: node.y - margin,
    width: node.width + margin * 2,
    height: node.height + margin * 2
  };
}

function rectsOverlap(first, second) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

function positionIsClear(node, position, nodes, margin = 24) {
  const probe = {
    x: position.x - margin,
    y: position.y - margin,
    width: node.width + margin * 2,
    height: node.height + margin * 2
  };
  return nodes.every((other) => other === node || !rectsOverlap(probe, rectFor(other)));
}

function moveSceneNode(scene, node, position, placement = null) {
  const semanticId = metaOf(node).semanticId;
  const dx = position.x - node.x;
  const dy = position.y - node.y;
  if (dx === 0 && dy === 0) {
    if (placement) metaOf(node).patchPlacement = placement;
    return;
  }
  const groups = new Set(node.groupIds ?? []);
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    const isBoundLabel = meta.role === 'label' && meta.node === semanticId;
    const sharesGroup = (element.groupIds ?? []).some((groupId) => groups.has(groupId));
    if (element === node || isBoundLabel || sharesGroup) {
      element.x = Number(element.x ?? 0) + dx;
      element.y = Number(element.y ?? 0) + dy;
    }
  }
  if (placement) metaOf(node).patchPlacement = placement;
}

function moveGeneratedNode(scene, node, position) {
  moveSceneNode(scene, node, position, {
    engine: 'collision-slot-v0.1',
    x: Math.round(position.x),
    y: Math.round(position.y)
  });
}

function preferredSidePosition(node, near, side, gap) {
  if (side === 'left') {
    return {
      x: near.x - node.width - gap,
      y: near.y + (near.height - node.height) / 2
    };
  }
  if (side === 'up') {
    return {
      x: near.x + (near.width - node.width) / 2,
      y: near.y - node.height - gap
    };
  }
  if (side === 'down') {
    return {
      x: near.x + (near.width - node.width) / 2,
      y: near.y + near.height + gap
    };
  }
  return {
    x: near.x + near.width + gap,
    y: near.y + (near.height - node.height) / 2
  };
}

function preferredSideCandidates(node, near, side, gap, nodes, clearance = 32) {
  const base = preferredSidePosition(node, near, side, gap);
  const candidates = [base];
  const horizontalSide = side === 'left' || side === 'right';

  for (const other of nodes) {
    if (other === node || other === near) continue;
    if (horizontalSide) {
      candidates.push(
        { x: base.x, y: other.y + other.height + clearance },
        { x: base.x, y: other.y - node.height - clearance }
      );
    } else {
      candidates.push(
        { x: other.x + other.width + clearance, y: base.y },
        { x: other.x - node.width - clearance, y: base.y }
      );
    }
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const rounded = { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    unique.set(`${rounded.x}:${rounded.y}`, rounded);
  }

  return [...unique.values()].sort((first, second) => {
    const firstDistance = Math.hypot(first.x - base.x, first.y - base.y);
    const secondDistance = Math.hypot(second.x - base.x, second.y - base.y);
    return firstDistance - secondDistance || first.y - second.y || first.x - second.x;
  });
}

function placeAddedNodesNearRequestedSide(scene, patch, newNodeIds, reservedNodeIds = new Set()) {
  const nodes = semanticElements(scene, 'node');
  const nodesById = bySemanticId(nodes);

  for (const op of patch.operations ?? []) {
    if (op.op !== 'addNode' || !op.semanticId || !newNodeIds.has(op.semanticId)) continue;
    if (reservedNodeIds.has(op.semanticId)) continue;
    if (op.position && Number.isFinite(op.position.x) && Number.isFinite(op.position.y)) continue;

    const node = nodesById.get(op.semanticId);
    const near = nodesById.get(op.near);
    if (!node || !near) continue;

    const side = ['left', 'right', 'up', 'down'].includes(op.side) ? op.side : 'right';
    const gap = Math.max(24, Number(op.gap ?? 100));
    const chosen = preferredSideCandidates(node, near, side, gap, nodes)
      .find((candidate) => positionIsClear(node, candidate, nodes, 24));
    if (!chosen) continue;

    moveSceneNode(scene, node, chosen, {
      engine: 'side-slot-v0.1',
      near: op.near,
      side,
      gap,
      x: chosen.x,
      y: chosen.y
    });
  }
}

function originalEdgeMap(scene) {
  return new Map(semanticElements(scene, 'edge').map((edge) => [metaOf(edge).semanticId, edge]));
}

function shiftTargetSideNodes(scene, source, target, axis, direction, amount, intent, insertedNode) {
  if (amount <= 0) return [];
  const nodes = semanticElements(scene, 'node');
  const targetCenter = axis === 'x'
    ? target.x + target.width / 2
    : target.y + target.height / 2;

  const shifted = nodes
    .filter((node) => node !== source && node !== insertedNode)
    .filter((node) => {
      const center = axis === 'x' ? node.x + node.width / 2 : node.y + node.height / 2;
      return direction > 0 ? center >= targetCenter - 0.5 : center <= targetCenter + 0.5;
    })
    .sort((first, second) => metaOf(first).semanticId.localeCompare(metaOf(second).semanticId));

  if (shifted.some((node) => node.frameId)) return null;

  for (const node of shifted) {
    const position = axis === 'x'
      ? { x: Math.round(node.x + direction * amount), y: node.y }
      : { x: node.x, y: Math.round(node.y + direction * amount) };
    moveSceneNode(scene, node, position);
    intent.changedNodes.add(metaOf(node).semanticId);
  }
  return shifted.map((node) => metaOf(node).semanticId);
}

function insertionCorridorPosition(source, target, insertedNode, axis, direction) {
  if (axis === 'x') {
    const sourceBoundary = direction > 0 ? source.x + source.width : source.x;
    const targetBoundary = direction > 0 ? target.x : target.x + target.width;
    const left = Math.min(sourceBoundary, targetBoundary);
    const right = Math.max(sourceBoundary, targetBoundary);
    return {
      x: Math.round((left + right - insertedNode.width) / 2),
      y: Math.round(
        ((source.y + source.height / 2) + (target.y + target.height / 2)) / 2
        - insertedNode.height / 2
      )
    };
  }

  const sourceBoundary = direction > 0 ? source.y + source.height : source.y;
  const targetBoundary = direction > 0 ? target.y : target.y + target.height;
  const top = Math.min(sourceBoundary, targetBoundary);
  const bottom = Math.max(sourceBoundary, targetBoundary);
  return {
    x: Math.round(
      ((source.x + source.width / 2) + (target.x + target.width / 2)) / 2
      - insertedNode.width / 2
    ),
    y: Math.round((top + bottom - insertedNode.height) / 2)
  };
}

function preserveInsertionCorridors(beforeScene, scene, patch, intent, newNodeIds) {
  const beforeEdges = originalEdgeMap(beforeScene);
  const nodes = semanticElements(scene, 'node');
  const nodesById = bySemanticId(nodes);
  const placed = new Set();
  const minGap = 72;

  for (const op of patch.operations ?? []) {
    if (op.op !== 'insertNodeBetween' || !op.semanticId || !newNodeIds.has(op.semanticId)) continue;
    const originalEdgeId = op.target ?? op.edge;
    const originalEdge = beforeEdges.get(originalEdgeId);
    if (!originalEdge) continue;
    const originalMeta = metaOf(originalEdge);
    const source = nodesById.get(originalMeta.from);
    const target = nodesById.get(originalMeta.to);
    const insertedNode = nodesById.get(op.semanticId);
    if (!source || !target || !insertedNode) continue;

    const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    const direction = (axis === 'x' ? dx : dy) >= 0 ? 1 : -1;

    const currentGap = axis === 'x'
      ? (direction > 0 ? target.x - (source.x + source.width) : source.x - (target.x + target.width))
      : (direction > 0 ? target.y - (source.y + source.height) : source.y - (target.y + target.height));
    const insertedSize = axis === 'x' ? insertedNode.width : insertedNode.height;
    const requiredGap = insertedSize + minGap * 2;
    const ripple = Math.max(0, Math.ceil(requiredGap - currentGap));

    const shiftedNodeIds = shiftTargetSideNodes(
      scene,
      source,
      target,
      axis,
      direction,
      ripple,
      intent,
      insertedNode
    );
    if (shiftedNodeIds === null) continue;

    const corridorPosition = insertionCorridorPosition(source, target, insertedNode, axis, direction);
    const refreshedNodes = semanticElements(scene, 'node');
    if (!positionIsClear(insertedNode, corridorPosition, refreshedNodes, Math.min(24, minGap / 3))) continue;

    moveSceneNode(scene, insertedNode, corridorPosition, {
      engine: 'insert-corridor-v0.1',
      originalEdge: originalEdgeId,
      axis,
      direction,
      minGap,
      ripple,
      shiftedNodes: shiftedNodeIds,
      x: corridorPosition.x,
      y: corridorPosition.y
    });
    placed.add(op.semanticId);
  }

  return placed;
}

function resolveAddedNodeOverlaps(scene, newNodeIds) {
  const nodes = semanticElements(scene, 'node');
  const newNodes = nodes
    .filter((node) => newNodeIds.has(metaOf(node).semanticId))
    .sort((first, second) => metaOf(first).semanticId.localeCompare(metaOf(second).semanticId));
  const gap = 72;

  for (const node of newNodes) {
    const overlapping = nodes.filter((other) => other !== node && rectsOverlap(rectFor(node), rectFor(other)));
    if (overlapping.length === 0) continue;

    const left = Math.min(...overlapping.map((other) => other.x));
    const right = Math.max(...overlapping.map((other) => other.x + other.width));
    const top = Math.min(...overlapping.map((other) => other.y));
    const bottom = Math.max(...overlapping.map((other) => other.y + other.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const candidates = [
      { x: centerX - node.width / 2, y: bottom + gap },
      { x: centerX - node.width / 2, y: top - node.height - gap },
      { x: right + gap, y: centerY - node.height / 2 },
      { x: left - node.width - gap, y: centerY - node.height / 2 }
    ].map((candidate) => ({
      x: Math.round(candidate.x),
      y: Math.round(candidate.y)
    }));

    candidates.sort((first, second) => {
      const firstDistance = Math.hypot(first.x - node.x, first.y - node.y);
      const secondDistance = Math.hypot(second.x - node.x, second.y - node.y);
      return firstDistance - secondDistance || first.y - second.y || first.x - second.x;
    });
    const chosen = candidates.find((candidate) => positionIsClear(node, candidate, nodes));
    if (!chosen) {
      throw new Error(`No collision-free local slot for patch-added node: ${metaOf(node).semanticId}`);
    }
    moveGeneratedNode(scene, node, chosen);
  }
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
  const corridorPlaced = preserveInsertionCorridors(before, scene, patch, intent, added.newNodeIds);
  placeAddedNodesNearRequestedSide(scene, patch, added.newNodeIds, corridorPlaced);
  resolveAddedNodeOverlaps(scene, added.newNodeIds);
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
    version: '0.3.0',
    affectedEdges: [...affectedEdges].sort(),
    newNodes: [...added.newNodeIds].sort(),
    newEdges: [...added.newEdgeIds].sort(),
    corridorPlacedNodes: [...corridorPlaced].sort(),
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
