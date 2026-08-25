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
  let workingSpec = clone(spec);
  let workingScene = clone(scene);
  let workingScore = currentScore;
  const decisions = [];
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
    workingSpec = bestSpec;
    workingScene = bestScene;
    workingScore = bestScore;
  }

  return { spec: workingSpec, scene: workingScene, score: workingScore, decisions };
}

function optimizeIndividuals(scene, spec, eligible, currentScore) {
  let workingSpec = clone(spec);
  let workingScene = clone(scene);
  let workingScore = currentScore;
  const decisions = [];

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
    if (!accepted) continue;
    workingSpec = bestSpec;
    workingScene = bestScene;
    workingScore = bestScore;
  }

  return { spec: workingSpec, scene: workingScene, score: workingScore, decisions };
}

function changedEdgeIds(originalSpec, selectedSpec, eligible) {
  const selectedById = new Map((selectedSpec.edges ?? []).map((edge) => [edgeId(edge), edge]));
  return eligible.map(edgeId).filter((id) => {
    const original = (originalSpec.edges ?? []).find((edge) => edgeId(edge) === id)?.routeHints?.direction ?? null;
    const selected = selectedById.get(id)?.routeHints?.direction ?? null;
    return original !== selected;
  });
}

export function optimizeEdgeRouting(scene, spec) {
  if (!isFlow(spec)) return scene;
  const primaryPairs = primaryPairSet(spec);
  const eligible = secondaryEligibleEdges(spec, primaryPairs);
  if (eligible.length === 0) return scene;

  const baselineSpec = clone(spec);
  const baselineScene = finalizeRouting(scene, baselineSpec);
  const baselineScore = score(baselineScene, baselineSpec);

  const edgeOnly = optimizeIndividuals(baselineScene, baselineSpec, eligible, baselineScore);
  const bundleStage = optimizeBundles(baselineScene, baselineSpec, eligible, baselineScore);
  const bundleThenEdge = optimizeIndividuals(bundleStage.scene, bundleStage.spec, eligible, bundleStage.score);

  const candidates = [
    {
      name: 'edge-only',
      ...edgeOnly,
      bundleDecisions: []
    },
    {
      name: 'bundle-then-edge',
      ...bundleThenEdge,
      bundleDecisions: bundleStage.decisions
    }
  ];
  candidates.sort((a, b) => a.score.cost - b.score.cost || a.name.localeCompare(b.name));
  const selected = candidates[0];
  const changedEdges = changedEdgeIds(baselineSpec, selected.spec, eligible);

  selected.scene.customData ??= {};
  selected.scene.customData.excalidrawSkill ??= {};
  selected.scene.customData.excalidrawSkill.routeOptimization = {
    version: '0.5.0',
    strategy: 'routing-strategy-portfolio',
    selectedStrategy: selected.name,
    scoring: 'shared-post-route-quality-score',
    bundlesConsidered: routingBundles(eligible).length,
    bundlesChanged: selected.bundleDecisions.filter((decision) => decision.accepted).length,
    bundleDecisions: selected.bundleDecisions,
    edgesConsidered: eligible.length,
    edgesChanged: changedEdges.length,
    baselineCost: baselineScore.cost,
    selectedCost: selected.score.cost,
    improvement: Number((baselineScore.cost - selected.score.cost).toFixed(2)),
    candidates: candidates.map((candidate) => ({
      strategy: candidate.name,
      cost: candidate.score.cost,
      hardPenalty: candidate.score.hardPenalty,
      acceptedBundles: candidate.bundleDecisions.filter((decision) => decision.accepted).length,
      acceptedEdges: candidate.decisions.filter((decision) => decision.accepted).length
    })),
    decisions: selected.decisions
  };
  return selected.scene;
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
