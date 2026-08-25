#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreLayoutCandidate } from './layout-score.mjs';

const FLOW_TYPES = new Set(['flow', 'service-flow', 'event-flow', 'data-flow']);
const MIN_BUNDLE = 3;
const MIN_SEPARATION = 28;
const MIN_IMPROVEMENT = 4;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function edgeId(edge) {
  return edge.semanticId ?? `${edge.from}_to_${edge.to}`;
}

function center(node) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function anchorFraction(node, side, fraction = 0.5) {
  const f = clamp(fraction, 0.12, 0.88);
  if (side === 'down') return { x: node.x + node.width * f, y: node.y + node.height };
  if (side === 'up') return { x: node.x + node.width * f, y: node.y };
  if (side === 'right') return { x: node.x + node.width, y: node.y + node.height * f };
  return { x: node.x, y: node.y + node.height * f };
}

function setEdgePoints(edge, points, sourceSide, targetSide, bundleMeta) {
  const first = points[0];
  edge.x = first.x;
  edge.y = first.y;
  edge.points = points.map((point) => [point.x - first.x, point.y - first.y]);
  const last = edge.points.at(-1) ?? [0, 0];
  edge.width = last[0];
  edge.height = last[1];
  const meta = metaOf(edge);
  meta.route ??= {};
  meta.route.sourceSide = sourceSide;
  meta.route.targetSide = targetSide;
  meta.route.axisLock = null;
  meta.route.bends = Math.max(0, points.length - 2);
  meta.flowBundleRepair = bundleMeta;
}

function primaryPairs(spec) {
  const ids = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let index = 0; index < ids.length - 1; index += 1) {
    pairs.add(`${ids[index]}->${ids[index + 1]}`);
  }
  return pairs;
}

function eligibleEdges(spec) {
  const primary = primaryPairs(spec);
  return (spec?.edges ?? []).filter((edge) => {
    if (edge.routeHints?.priority === 'primary') return false;
    if (primary.has(`${edge.from}->${edge.to}`)) return false;
    return true;
  });
}

function bundles(spec) {
  const eligible = eligibleEdges(spec);
  const result = [];
  for (const [kind, endpoint] of [['fan-out', 'from'], ['fan-in', 'to']]) {
    const groups = new Map();
    for (const edge of eligible) {
      const id = edge[endpoint];
      const list = groups.get(id) ?? [];
      list.push(edge);
      groups.set(id, list);
    }
    for (const [node, edges] of groups) {
      if (edges.length < MIN_BUNDLE) continue;
      result.push({ kind, node, edges: [...edges].sort((a, b) => edgeId(a).localeCompare(edgeId(b))) });
    }
  }
  return result.sort((a, b) => a.node.localeCompare(b.node) || a.kind.localeCompare(b.kind));
}

function relation(values, pivot, extent = 0) {
  const allPositive = values.every((value) => value > pivot + extent + MIN_SEPARATION);
  if (allPositive) return 1;
  const allNegative = values.every((value) => value < pivot - extent - MIN_SEPARATION);
  if (allNegative) return -1;
  return 0;
}

function nestedFractions(items, commonCenter, vertical, horizontal) {
  const sorted = [...items].sort((a, b) => {
    const ad = vertical * (center(a.peer).y - commonCenter.y);
    const bd = vertical * (center(b.peer).y - commonCenter.y);
    return ad - bd || a.id.localeCompare(b.id);
  });
  const result = new Map();
  sorted.forEach((item, index) => {
    const t = sorted.length === 1 ? 0.5 : index / (sorted.length - 1);
    const fraction = horizontal > 0 ? 0.8 - 0.6 * t : 0.2 + 0.6 * t;
    result.set(item.id, fraction);
  });
  return result;
}

function buildFanOutCandidate(scene, bundle) {
  const nodes = new Map();
  const sceneEdges = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') sceneEdges.set(meta.semanticId, element);
  }
  const common = nodes.get(bundle.node);
  if (!common) return null;
  const commonCenter = center(common);
  const items = bundle.edges.map((specEdge) => ({
    id: edgeId(specEdge),
    specEdge,
    edge: sceneEdges.get(edgeId(specEdge)),
    peer: nodes.get(specEdge.to)
  })).filter((item) => item.edge && item.peer);
  if (items.length !== bundle.edges.length) return null;

  const horizontal = relation(items.map((item) => center(item.peer).x), commonCenter.x, common.width / 2);
  const vertical = relation(items.map((item) => center(item.peer).y), commonCenter.y, common.height / 2);
  if (!horizontal || !vertical) return null;

  const sourceSide = vertical > 0 ? 'down' : 'up';
  const targetSide = horizontal > 0 ? 'left' : 'right';
  const fractions = nestedFractions(items, commonCenter, vertical, horizontal);
  for (const item of items) {
    const start = anchorFraction(common, sourceSide, fractions.get(item.id));
    const end = anchorFraction(item.peer, targetSide, 0.5);
    const elbow = { x: start.x, y: end.y };
    setEdgePoints(item.edge, [start, elbow, end], sourceSide, targetSide, {
      engine: 'flow-bundle-v0.1',
      kind: bundle.kind,
      node: bundle.node,
      template: 'vertical-source-horizontal-target',
      portFraction: Number(fractions.get(item.id).toFixed(3))
    });
  }
  return scene;
}

function buildFanInCandidate(scene, bundle) {
  const nodes = new Map();
  const sceneEdges = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') sceneEdges.set(meta.semanticId, element);
  }
  const common = nodes.get(bundle.node);
  if (!common) return null;
  const commonCenter = center(common);
  const items = bundle.edges.map((specEdge) => ({
    id: edgeId(specEdge),
    specEdge,
    edge: sceneEdges.get(edgeId(specEdge)),
    peer: nodes.get(specEdge.from)
  })).filter((item) => item.edge && item.peer);
  if (items.length !== bundle.edges.length) return null;

  const horizontal = relation(items.map((item) => center(item.peer).x), commonCenter.x, common.width / 2);
  const vertical = relation(items.map((item) => center(item.peer).y), commonCenter.y, common.height / 2);
  if (!horizontal || !vertical) return null;

  const sourceSide = horizontal < 0 ? 'right' : 'left';
  const targetSide = vertical > 0 ? 'down' : 'up';
  const fractions = nestedFractions(items, commonCenter, vertical, horizontal);
  for (const item of items) {
    const start = anchorFraction(item.peer, sourceSide, 0.5);
    const end = anchorFraction(common, targetSide, fractions.get(item.id));
    const elbow = { x: end.x, y: start.y };
    setEdgePoints(item.edge, [start, elbow, end], sourceSide, targetSide, {
      engine: 'flow-bundle-v0.1',
      kind: bundle.kind,
      node: bundle.node,
      template: 'horizontal-source-vertical-target',
      portFraction: Number(fractions.get(item.id).toFixed(3))
    });
  }
  return scene;
}

function buildCandidate(scene, bundle) {
  const candidate = clone(scene);
  return bundle.kind === 'fan-out'
    ? buildFanOutCandidate(candidate, bundle)
    : buildFanInCandidate(candidate, bundle);
}

export function repairFlowBundles(scene, spec) {
  if (!FLOW_TYPES.has(spec?.diagramType)) return scene;
  let working = clone(scene);
  let workingScore = scoreLayoutCandidate(working, spec, { aspectSoftLimit: 6 });
  const decisions = [];

  for (const bundle of bundles(spec)) {
    const candidate = buildCandidate(working, bundle);
    if (!candidate) {
      decisions.push({ kind: bundle.kind, node: bundle.node, edgeIds: bundle.edges.map(edgeId), considered: false, accepted: false, reason: 'not-diagonal-stack' });
      continue;
    }
    const candidateScore = scoreLayoutCandidate(candidate, spec, { aspectSoftLimit: 6 });
    const improvement = workingScore.cost - candidateScore.cost;
    const hardSafe = candidateScore.hardPenalty <= workingScore.hardPenalty;
    const accepted = hardSafe && improvement >= MIN_IMPROVEMENT;
    decisions.push({
      kind: bundle.kind,
      node: bundle.node,
      edgeIds: bundle.edges.map(edgeId),
      considered: true,
      accepted,
      costBefore: workingScore.cost,
      costAfter: accepted ? candidateScore.cost : workingScore.cost,
      hardPenaltyBefore: workingScore.hardPenalty,
      hardPenaltyAfter: candidateScore.hardPenalty,
      improvement: Number((accepted ? improvement : 0).toFixed(2))
    });
    if (!accepted) continue;
    working = candidate;
    workingScore = candidateScore;
  }

  working.customData ??= {};
  working.customData.excalidrawSkill ??= {};
  working.customData.excalidrawSkill.flowBundleRepair = {
    version: '0.1.0',
    strategy: 'diagonal-stack-bundle-geometry',
    considered: decisions.filter((decision) => decision.considered).length,
    accepted: decisions.filter((decision) => decision.accepted).length,
    finalCost: workingScore.cost,
    decisions
  };
  return working;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) {
    console.error('Usage: node src/repair-flow-bundles.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  const result = repairFlowBundles(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, result);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    repair: result.customData?.excalidrawSkill?.flowBundleRepair ?? null
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`repair-flow-bundles failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
