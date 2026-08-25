#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeEdges } from './route-edges.mjs';
import { repairRoutes } from './repair-routes.mjs';
import { simplifyRoutes } from './simplify-routes.mjs';
import { scoreLayoutCandidate } from './layout-score.mjs';

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

function edgeId(edge) {
  return edge.semanticId ?? `${edge.from}_to_${edge.to}`;
}

function primaryPairSet(spec) {
  const ids = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let index = 0; index < ids.length - 1; index += 1) {
    pairs.add(`${ids[index]}->${ids[index + 1]}`);
  }
  return pairs;
}

function candidateDirections(direction) {
  if (direction === 'up' || direction === 'down') return [direction, null, 'left', 'right'];
  if (direction === 'left' || direction === 'right') return [direction, null, 'up', 'down'];
  return [null];
}

function finalizeRouting(scene, spec) {
  return simplifyRoutes(repairRoutes(routeEdges(clone(scene), spec)));
}

function score(scene, spec) {
  return scoreLayoutCandidate(scene, spec, { aspectSoftLimit: 6 });
}

function withDirection(spec, semanticId, direction) {
  const next = clone(spec);
  const edge = (next.edges ?? []).find((candidate) => edgeId(candidate) === semanticId);
  if (!edge) return next;
  edge.routeHints ??= {};
  if (direction) edge.routeHints.direction = direction;
  else delete edge.routeHints.direction;
  return next;
}

function withBundleDirection(spec, semanticIds, direction) {
  const ids = new Set(semanticIds);
  const next = clone(spec);
  for (const edge of next.edges ?? []) {
    if (!ids.has(edgeId(edge))) continue;
    edge.routeHints ??= {};
    if (direction) edge.routeHints.direction = direction;
    else delete edge.routeHints.direction;
  }
  return next;
}

function flowAxisDirection(spec) {
  return (spec?.layout?.direction ?? 'left-to-right') === 'top-to-bottom' ? 'down' : 'right';
}

function isFlow(spec) {
  return ['service-flow', 'event-flow', 'data-flow', 'flow'].includes(spec?.diagramType);
}

function secondaryEligibleEdges(spec, primaryPairs) {
  return (spec.edges ?? []).filter((edge) => {
    const direction = edge.routeHints?.direction;
    const primary = edge.routeHints?.priority === 'primary'
      || primaryPairs.has(`${edge.from}->${edge.to}`);
    return !primary && ['up', 'down', 'left', 'right'].includes(direction);
  });
}

export function routingBundles(edges) {
  const bundles = [];
  for (const [kind, endpoint] of [['fan-out', 'from'], ['fan-in', 'to']]) {
    const groups = new Map();
    for (const edge of edges) {
      const node = edge[endpoint];
      const list = groups.get(node) ?? [];
      list.push(edge);
      groups.set(node, list);
    }
    for (const [node, group] of groups) {
      if (group.length < 2) continue;
      bundles.push({
        kind,
        node,
        edgeIds: group.map(edgeId).sort()
      });
    }
  }
  return bundles.sort((a, b) => a.node.localeCompare(b.node) || a.kind.localeCompare(b.kind));
}

function optimizeBundles(scene, spec, eligible, currentScore) {
  let workingSpec = spec;
  let workingScene = scene;
  let workingScore = currentScore;
  const decisions = [];
  const changedEdges = new Set();
  const axisDirection = flowAxisDirection(spec);

  for (const bundle of routingBundles(eligible)) {
    const beforeDirections = Object.fromEntries(bundle.edgeIds.map((id) => {
      const edge = (workingSpec.edges ?? []).find((candidate) => edgeId(candidate) === id);
      return [id, edge?.routeHints?.direction ?? null];
    }));
    let bestSpec = workingSpec;
    let bestScene = workingScene;
    let bestScore = workingScore;
    let bestStrategy = 'preserve';
    let bestDirection = null;

    for (const candidate of [
      { strategy: 'flow-axis', direction: axisDirection },
      { strategy: 'auto', direction: null }
    ]) {
      const candidateSpec = withBundleDirection(workingSpec, bundle.edgeIds, candidate.direction);
      const candidateScene = finalizeRouting(workingScene, candidateSpec);
      const candidateScore = score(candidateScene, candidateSpec);
      const hardSafe = candidateScore.hardPenalty <= workingScore.hardPenalty;
      if (hardSafe && candidateScore.cost + 0.01 < bestScore.cost) {
        bestSpec = candidateSpec;
        bestScene = candidateScene;
        bestScore = candidateScore;
        bestStrategy = candidate.strategy;
        bestDirection = candidate.direction;
      }
    }

    const improvement = workingScore.cost - bestScore.cost;
    const accepted = bestStrategy !== 'preserve' && improvement >= 4;
    decisions.push({
      ...bundle,
      accepted,
      strategy: accepted ? bestStrategy : 'preserve',
      selectedDirection: accepted ? bestDirection : null,
      originalDirections: beforeDirections,
      costBefore: workingScore.cost,
      costAfter: accepted ? bestScore.cost : workingScore.cost,
      improvement: Number((accepted ? improvement : 0).toFixed(2))
    });
    if (!accepted) continue;

    for (const id of bundle.edgeIds) {
      const previous = beforeDirections[id];
      if (previous !== bestDirection) changedEdges.add(id);
    }
    workingSpec = bestSpec;
    workingScene = bestScene;
    workingScore = bestScore;
  }

  return { workingSpec, workingScene, workingScore, decisions, changedEdges };
}

export function optimizeEdgeRouting(scene, spec) {
  if (!isFlow(spec)) return scene;
  const primaryPairs = primaryPairSet(spec);
  const eligible = secondaryEligibleEdges(spec, primaryPairs);
  if (eligible.length === 0) return scene;

  let workingSpec = clone(spec);
  let workingScene = finalizeRouting(scene, workingSpec);
  let workingScore = score(workingScene, workingSpec);
  const baselineCost = workingScore.cost;
  const decisions = [];
  const changedEdges = new Set();

  const bundleResult = optimizeBundles(workingScene, workingSpec, eligible, workingScore);
  workingSpec = bundleResult.workingSpec;
  workingScene = bundleResult.workingScene;
  workingScore = bundleResult.workingScore;
  for (const id of bundleResult.changedEdges) changedEdges.add(id);

  for (const edge of eligible) {
    const id = edgeId(edge);
    const originalDirection = (workingSpec.edges ?? []).find((candidate) => edgeId(candidate) === id)?.routeHints?.direction ?? null;
    let bestSpec = workingSpec;
    let bestScene = workingScene;
    let bestScore = workingScore;
    let bestDirection = originalDirection;

    for (const direction of candidateDirections(originalDirection)) {
      if (direction === originalDirection) continue;
      const candidateSpec = withDirection(workingSpec, id, direction);
      const candidateScene = finalizeRouting(workingScene, candidateSpec);
      const candidateScore = score(candidateScene, candidateSpec);
      const hardSafe = candidateScore.hardPenalty <= workingScore.hardPenalty;
      if (hardSafe && candidateScore.cost + 0.01 < bestScore.cost) {
        bestSpec = candidateSpec;
        bestScene = candidateScene;
        bestScore = candidateScore;
        bestDirection = direction;
      }
    }

    const improvement = workingScore.cost - bestScore.cost;
    const accepted = bestDirection !== originalDirection && improvement >= 4;
    decisions.push({
      edge: id,
      preferredDirection: originalDirection,
      selectedDirection: accepted ? bestDirection : originalDirection,
      accepted,
      costBefore: workingScore.cost,
      costAfter: accepted ? bestScore.cost : workingScore.cost,
      improvement: Number((accepted ? improvement : 0).toFixed(2))
    });
    if (accepted) {
      changedEdges.add(id);
      workingSpec = bestSpec;
      workingScene = bestScene;
      workingScore = bestScore;
    }
  }

  workingScene.customData ??= {};
  workingScene.customData.excalidrawSkill ??= {};
  workingScene.customData.excalidrawSkill.routeOptimization = {
    version: '0.4.0',
    strategy: 'bundle-then-edge-secondary-direction-search',
    scoring: 'shared-post-route-quality-score',
    bundlesConsidered: bundleResult.decisions.length,
    bundlesChanged: bundleResult.decisions.filter((decision) => decision.accepted).length,
    bundleDecisions: bundleResult.decisions,
    edgesConsidered: eligible.length,
    edgesChanged: changedEdges.size,
    baselineCost,
    selectedCost: workingScore.cost,
    improvement: Number((baselineCost - workingScore.cost).toFixed(2)),
    decisions
  };
  return workingScene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/optimize-edge-routing.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : scenePath;
  const optimized = optimizeEdgeRouting(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, optimized);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    optimization: optimized.customData?.excalidrawSkill?.routeOptimization ?? null
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`optimize-edge-routing failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
