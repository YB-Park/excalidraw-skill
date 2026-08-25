#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeEdges } from './route-edges.mjs';
import { repairRoutes } from './repair-routes.mjs';
import { simplifyRoutes } from './simplify-routes.mjs';
import { createQualityReport } from './quality-report.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';

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

function isFlow(spec) {
  return ['service-flow', 'event-flow', 'data-flow', 'flow'].includes(spec?.diagramType);
}

function nodeElements(scene) {
  return (scene.elements ?? []).filter((element) => metaOf(element).role === 'node');
}

function nodeBySemanticId(scene, semanticId) {
  return nodeElements(scene).find((element) => metaOf(element).semanticId === semanticId) ?? null;
}

function moveNodeAndLabel(scene, semanticId, dx, dy) {
  const node = nodeBySemanticId(scene, semanticId);
  if (!node || (dx === 0 && dy === 0)) return scene;
  node.x += dx;
  node.y += dy;
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'label' && meta.node === semanticId) {
      element.x += dx;
      element.y += dy;
    }
  }
  return scene;
}

function finalizedRouting(scene, spec) {
  return simplifyRoutes(repairRoutes(routeEdges(clone(scene), spec)));
}

function score(scene, spec) {
  const routed = finalizedRouting(scene, spec);
  const quality = createQualityReport(routed, spec);
  const perceptual = createPerceptualQuality(routed, spec);
  const metrics = quality.metrics;
  const hardPenalty = metrics.nodeOverlaps * 1_000_000
    + metrics.edgeNodeCrossings * 1_000_000
    + metrics.endpointOverlaps * 500_000
    + metrics.endpointApproachViolations * 500_000
    + metrics.labelNodeOverlaps * 100_000
    + metrics.textOverflows * 100_000
    + (quality.familyPass ? 0 : 1_000_000);
  const crossingPenalty = metrics.edgeCrossings * 120;
  const aspectPenalty = Math.max(0, (metrics.aspectRatio ?? 1) - 6) * 15;
  const displacementPenalty = 0;
  return {
    cost: Number((hardPenalty + crossingPenalty + aspectPenalty + displacementPenalty + (perceptual.metrics.readabilityCost ?? 0)).toFixed(2)),
    hardPenalty,
    routed,
    quality,
    perceptual
  };
}

function edgeAdjacency(spec) {
  const neighbors = new Map();
  for (const edge of spec?.edges ?? []) {
    for (const [a, b] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      const list = neighbors.get(a) ?? [];
      list.push(b);
      neighbors.set(a, list);
    }
  }
  return neighbors;
}

function primarySet(spec) {
  return new Set(spec?.layout?.primaryFlow ?? []);
}

function crossCenter(node, direction) {
  return direction === 'top-to-bottom'
    ? node.x + node.width / 2
    : node.y + node.height / 2;
}

function candidateDeltas(scene, spec, semanticId, originalScene) {
  const direction = spec?.layout?.direction ?? 'left-to-right';
  const node = nodeBySemanticId(scene, semanticId);
  const original = nodeBySemanticId(originalScene, semanticId);
  if (!node || !original) return [{ dx: 0, dy: 0, reason: 'keep' }];
  const neighbors = edgeAdjacency(spec).get(semanticId) ?? [];
  const neighborCenters = neighbors
    .map((id) => nodeBySemanticId(scene, id))
    .filter(Boolean)
    .map((neighbor) => crossCenter(neighbor, direction));
  const targets = new Set([crossCenter(node, direction)]);
  const base = crossCenter(original, direction);
  for (const offset of [-120, -80, -40, 40, 80, 120]) targets.add(base + offset);
  if (neighborCenters.length > 0) {
    const sorted = neighborCenters.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const offset of [0, -40, 40]) targets.add(median + offset);
  }
  const maxDisplacement = 140;
  const current = crossCenter(node, direction);
  return [...targets]
    .filter((target) => Math.abs(target - base) <= maxDisplacement)
    .map((target) => {
      const delta = target - current;
      return direction === 'top-to-bottom'
        ? { dx: delta, dy: 0, reason: target === base ? 'original' : 'cross-axis-search' }
        : { dx: 0, dy: delta, reason: target === base ? 'original' : 'cross-axis-search' };
    })
    .filter((candidate, index, all) => all.findIndex((other) => other.dx === candidate.dx && other.dy === candidate.dy) === index);
}

function eligibleNodes(spec) {
  const primary = primarySet(spec);
  const degrees = new Map();
  for (const edge of spec?.edges ?? []) {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  }
  return (spec?.nodes ?? [])
    .filter((node) => !primary.has(node.semanticId))
    .sort((a, b) => (degrees.get(b.semanticId) ?? 0) - (degrees.get(a.semanticId) ?? 0)
      || (a.layoutHints?.rank ?? 0) - (b.layoutHints?.rank ?? 0)
      || a.semanticId.localeCompare(b.semanticId));
}

export function refineFlowPositions(scene, spec) {
  if (!isFlow(spec)) return scene;
  const candidates = eligibleNodes(spec);
  if (candidates.length === 0) return scene;

  const originalScene = clone(scene);
  let workingScene = clone(scene);
  let workingScore = score(workingScene, spec);
  const baselineCost = workingScore.cost;
  const decisions = [];
  const acceptedMoves = new Map();

  for (let pass = 0; pass < 2; pass += 1) {
    let changedInPass = 0;
    for (const nodeSpec of candidates) {
      const semanticId = nodeSpec.semanticId;
      let bestScene = workingScene;
      let bestScore = workingScore;
      let bestMove = { dx: 0, dy: 0, reason: 'keep' };
      for (const move of candidateDeltas(workingScene, spec, semanticId, originalScene)) {
        if (move.dx === 0 && move.dy === 0) continue;
        const candidateScene = moveNodeAndLabel(clone(workingScene), semanticId, move.dx, move.dy);
        const candidateScore = score(candidateScene, spec);
        const hardSafe = candidateScore.hardPenalty <= workingScore.hardPenalty;
        if (hardSafe && candidateScore.cost + 0.01 < bestScore.cost) {
          bestScene = candidateScene;
          bestScore = candidateScore;
          bestMove = move;
        }
      }
      const improvement = workingScore.cost - bestScore.cost;
      if ((bestMove.dx !== 0 || bestMove.dy !== 0) && improvement >= 3) {
        workingScene = bestScene;
        workingScore = bestScore;
        changedInPass += 1;
        const previous = acceptedMoves.get(semanticId) ?? { dx: 0, dy: 0, improvement: 0 };
        acceptedMoves.set(semanticId, {
          dx: previous.dx + bestMove.dx,
          dy: previous.dy + bestMove.dy,
          improvement: Number((previous.improvement + improvement).toFixed(2))
        });
        decisions.push({
          pass,
          node: semanticId,
          dx: bestMove.dx,
          dy: bestMove.dy,
          costBefore: Number((workingScore.cost + improvement).toFixed(2)),
          costAfter: workingScore.cost,
          improvement: Number(improvement.toFixed(2))
        });
      }
    }
    if (changedInPass === 0) break;
  }

  workingScene.customData ??= {};
  workingScene.customData.excalidrawSkill ??= {};
  workingScene.customData.excalidrawSkill.positionRefinement = {
    version: '0.1.0',
    strategy: 'bounded-cross-axis-local-search',
    candidates: candidates.length,
    nodesChanged: acceptedMoves.size,
    baselineCost,
    selectedCost: workingScore.cost,
    improvement: Number((baselineCost - workingScore.cost).toFixed(2)),
    moves: Object.fromEntries(acceptedMoves),
    decisions
  };
  return workingScene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/refine-flow-positions.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : scenePath;
  const refined = refineFlowPositions(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, refined);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    refinement: refined.customData?.excalidrawSkill?.positionRefinement ?? null
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`refine-flow-positions failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
