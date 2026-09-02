#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { polylineLength, rectOf, segmentIntersectsRect, segmentsFromPoints } from './geometry.mjs';

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function absolutePoints(edge) {
  return (edge?.points ?? []).map(([x, y]) => ({ x: Number(edge.x) + Number(x), y: Number(edge.y) + Number(y) }));
}

function setEdgePoints(edge, points) {
  const first = points[0];
  edge.x = first.x;
  edge.y = first.y;
  edge.points = points.map((point) => [point.x - first.x, point.y - first.y]);
  const last = edge.points.at(-1) ?? [0, 0];
  edge.width = last[0];
  edge.height = last[1];
}

function center(node) {
  return { x: Number(node.x) + Number(node.width) / 2, y: Number(node.y) + Number(node.height) / 2 };
}

function previousRect(node, move) {
  return { x: Number(node.x) - Number(move?.dx ?? 0), y: Number(node.y) - Number(move?.dy ?? 0), width: Number(node.width), height: Number(node.height) };
}

function sideAt(node, point) {
  const epsilon = 1e-3;
  if (Math.abs(point.y - node.y) < epsilon) return 'up';
  if (Math.abs(point.y - (node.y + node.height)) < epsilon) return 'down';
  if (Math.abs(point.x - node.x) < epsilon) return 'left';
  if (Math.abs(point.x - (node.x + node.width)) < epsilon) return 'right';
  return null;
}

function facingSide(node, other) {
  const from = center(node);
  const to = center(other);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

function fractionOnSide(node, point, side) {
  if (side === 'left' || side === 'right') return Math.max(0.1, Math.min(0.9, (point.y - node.y) / Math.max(1, node.height)));
  return Math.max(0.1, Math.min(0.9, (point.x - node.x) / Math.max(1, node.width)));
}

function pointOnSide(node, side, fraction) {
  if (side === 'up') return { x: node.x + node.width * fraction, y: node.y };
  if (side === 'down') return { x: node.x + node.width * fraction, y: node.y + node.height };
  if (side === 'left') return { x: node.x, y: node.y + node.height * fraction };
  return { x: node.x + node.width, y: node.y + node.height * fraction };
}

function outward(point, side, distance = 24) {
  if (side === 'up') return { x: point.x, y: point.y - distance };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function compact(points) {
  const result = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    if (result.length >= 2) {
      const a = result[result.length - 2];
      const b = result[result.length - 1];
      const collinear = (a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y);
      if (collinear) {
        result[result.length - 1] = point;
        continue;
      }
    }
    result.push(point);
  }
  return result;
}

function routeCandidates(start, end, sourceSide, targetSide) {
  const startStub = outward(start, sourceSide);
  const endStub = outward(end, targetSide);
  const sourceVertical = sourceSide === 'up' || sourceSide === 'down';
  const targetVertical = targetSide === 'up' || targetSide === 'down';
  const candidates = [];
  if (sourceVertical && targetVertical) {
    const midY = (startStub.y + endStub.y) / 2;
    candidates.push([start, startStub, { x: startStub.x, y: midY }, { x: endStub.x, y: midY }, endStub, end]);
    candidates.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
  } else if (!sourceVertical && !targetVertical) {
    const midX = (startStub.x + endStub.x) / 2;
    candidates.push([start, startStub, { x: midX, y: startStub.y }, { x: midX, y: endStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  } else {
    candidates.push([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]);
    candidates.push([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
  }
  return candidates.map(compact).filter((points) => points.length >= 2);
}

function nodeHits(points, edgeMeta, nodes) {
  const segments = segmentsFromPoints(points);
  let hits = 0;
  for (const [semanticId, node] of nodes) {
    if (semanticId === edgeMeta.from || semanticId === edgeMeta.to) continue;
    if (segments.some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) hits += 1;
  }
  return hits;
}

function chooseRoute(edge, nodes, movesBySemanticId) {
  const edgeMeta = metaOf(edge);
  const source = nodes.get(edgeMeta.from);
  const target = nodes.get(edgeMeta.to);
  if (!source || !target) return null;
  const sourceMove = movesBySemanticId.get(edgeMeta.from) ?? null;
  const targetMove = movesBySemanticId.get(edgeMeta.to) ?? null;
  if (!sourceMove && !targetMove) return null;

  const current = absolutePoints(edge);
  if (current.length < 2) return null;
  const oldSource = previousRect(source, sourceMove);
  const oldTarget = previousRect(target, targetMove);
  const oldStart = current[0];
  const oldEnd = current.at(-1);
  const sourceSide = sideAt(oldSource, oldStart) ?? edgeMeta.route?.sourceSide ?? facingSide(source, target);
  const targetSide = sideAt(oldTarget, oldEnd) ?? edgeMeta.route?.targetSide ?? facingSide(target, source);
  const sourceFraction = sideAt(oldSource, oldStart) ? fractionOnSide(oldSource, oldStart, sourceSide) : 0.5;
  const targetFraction = sideAt(oldTarget, oldEnd) ? fractionOnSide(oldTarget, oldEnd, targetSide) : 0.5;
  const start = pointOnSide(source, sourceSide, sourceFraction);
  const end = pointOnSide(target, targetSide, targetFraction);
  const candidates = routeCandidates(start, end, sourceSide, targetSide)
    .map((points) => ({ points, hits: nodeHits(points, edgeMeta, nodes), length: polylineLength(points), bends: Math.max(0, points.length - 2) }))
    .sort((a, b) => a.hits - b.hits || a.bends - b.bends || a.length - b.length);
  const chosen = candidates[0];
  if (!chosen) return null;
  const oldMid = { x: (oldStart.x + oldEnd.x) / 2, y: (oldStart.y + oldEnd.y) / 2 };
  const newMid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return { points: chosen.points, sourceSide, targetSide, labelDx: newMid.x - oldMid.x, labelDy: newMid.y - oldMid.y, nodeHits: chosen.hits };
}

function reconcileEdges(scene, moves) {
  if (moves.length === 0) return [];
  const movesBySemanticId = new Map(moves.map((move) => [move.semanticId, move]));
  const nodes = new Map();
  const edges = [];
  const labelsByEdge = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && typeof meta.semanticId === 'string') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
    if (meta.role === 'edge-label' && typeof meta.edge === 'string') labelsByEdge.set(meta.edge, element);
  }

  const reconciled = [];
  for (const edge of edges) {
    const route = chooseRoute(edge, nodes, movesBySemanticId);
    if (!route) continue;
    setEdgePoints(edge, route.points);
    const meta = metaOf(edge);
    meta.route ??= {};
    meta.route.sourceSide = route.sourceSide;
    meta.route.targetSide = route.targetSide;
    meta.layoutStateReconciled = true;
    const label = labelsByEdge.get(meta.semanticId);
    if (label) {
      label.x += route.labelDx;
      label.y += route.labelDy;
    }
    reconciled.push({ semanticId: meta.semanticId, sourceSide: route.sourceSide, targetSide: route.targetSide, nodeHits: route.nodeHits });
  }
  return reconciled;
}

export function captureLayoutState(scene) {
  const nodes = {};
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role !== 'node' || typeof meta.semanticId !== 'string') continue;
    nodes[meta.semanticId] = {
      x: Number(element.x),
      y: Number(element.y),
      width: Number(element.width),
      height: Number(element.height),
      locked: true
    };
  }
  return {
    version: '1.0',
    coordinateSpace: 'excalidraw-scene',
    nodes
  };
}

export function applyLayoutState(scene, layoutState) {
  const next = structuredClone(scene);
  const byId = new Map((next.elements ?? []).map((element) => [element.id, element]));
  const moves = [];

  for (const element of next.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role !== 'node' || typeof meta.semanticId !== 'string') continue;
    const desired = layoutState?.nodes?.[meta.semanticId];
    if (!desired || desired.locked === false) continue;
    const dx = Number(desired.x) - Number(element.x);
    const dy = Number(desired.y) - Number(element.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) continue;

    element.x += dx;
    element.y += dy;
    meta.manualLayout = true;
    meta.manualLayoutSource = 'layout-state';
    for (const bound of element.boundElements ?? []) {
      const child = byId.get(bound.id);
      if (child?.type === 'text') {
        child.x += dx;
        child.y += dy;
      }
    }
    moves.push({ semanticId: meta.semanticId, dx, dy });
  }

  const reconciledEdges = reconcileEdges(next, moves);
  next.customData ??= {};
  next.customData.excalidrawSkill ??= {};
  next.customData.excalidrawSkill.layoutStateReconciliation = {
    version: '0.1.0',
    movedNodes: moves.length,
    reconciledEdges: reconciledEdges.length,
    requiresFreshReview: true
  };

  return { scene: next, moves, reconciledEdges, requiresFreshReview: true };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const [command, scenePath, statePath] = process.argv.slice(2);
  if (command === 'capture' && scenePath) {
    const output = statePath ?? `${scenePath}.layout-state.json`;
    writeJson(output, captureLayoutState(readJson(scenePath)));
    console.log(output);
    return;
  }
  if (command === 'apply' && scenePath && statePath) {
    const result = applyLayoutState(readJson(scenePath), readJson(statePath));
    writeJson(scenePath, result.scene);
    console.log(JSON.stringify({ scenePath, moves: result.moves, reconciledEdges: result.reconciledEdges, requiresFreshReview: true }, null, 2));
    return;
  }
  console.error('Usage: layout-state <capture|apply> <scene.excalidraw> [layout-state.json]');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
