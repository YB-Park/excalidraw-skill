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

function metaOf(element) {
  return element.customData?.excalidrawSkill ?? {};
}

export function permutations(values) {
  if (values.length <= 1) return [values.slice()];
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    const head = values[index];
    const rest = values.slice(0, index).concat(values.slice(index + 1));
    for (const tail of permutations(rest)) result.push([head, ...tail]);
  }
  return result;
}

function nodeMap(scene) {
  return new Map((scene.elements ?? [])
    .filter((element) => metaOf(element).role === 'node')
    .map((element) => [metaOf(element).semanticId, element]));
}

function moveNodeAndLabel(scene, semanticId, centerX, centerY) {
  const nodes = nodeMap(scene);
  const node = nodes.get(semanticId);
  if (!node) return;
  const nextX = centerX - node.width / 2;
  const nextY = centerY - node.height / 2;
  const dx = nextX - node.x;
  const dy = nextY - node.y;
  node.x = nextX;
  node.y = nextY;
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'label' && meta.node === semanticId) {
      element.x += dx;
      element.y += dy;
    }
  }
}

function reorderGroup(scene, ids, order) {
  const nodes = nodeMap(scene);
  const slots = ids.map((id) => {
    const node = nodes.get(id);
    return {
      centerX: node.x + node.width / 2,
      centerY: node.y + node.height / 2
    };
  }).sort((first, second) => first.centerY - second.centerY || first.centerX - second.centerX);
  order.forEach((id, index) => {
    moveNodeAndLabel(scene, id, slots[index].centerX, slots[index].centerY);
  });
  return scene;
}

function finalizedRouting(scene, spec) {
  return simplifyRoutes(repairRoutes(routeEdges(clone(scene), spec)));
}

function candidateScore(scene, spec) {
  const routed = finalizedRouting(scene, spec);
  return { ...scoreLayoutCandidate(routed, spec, { aspectSoftLimit: 5 }), routed };
}

function optimizationGroups(spec) {
  const groups = new Map();
  for (const node of spec?.nodes ?? []) {
    const lane = node.layoutHints?.lane;
    const rank = node.layoutHints?.rank;
    if (!lane || !Number.isFinite(rank)) continue;
    const key = `${lane}::${rank}`;
    const list = groups.get(key) ?? [];
    list.push(node.semanticId);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1 && ids.length <= 4)
    .map(([key, ids]) => ({ key, ids }));
}

export function optimizeFlowLayout(scene, spec) {
  if (!['service-flow', 'event-flow', 'data-flow', 'flow'].includes(spec?.diagramType)) return scene;
  const groups = optimizationGroups(spec);
  if (groups.length === 0) {
    scene.customData ??= {};
    scene.customData.excalidrawSkill ??= {};
    scene.customData.excalidrawSkill.flowOptimization = {
      version: '0.3.0',
      groupsConsidered: 0,
      groupsChanged: 0
    };
    return scene;
  }

  let bestScene = clone(scene);
  let best = candidateScore(bestScene, spec);
  const baselineCost = best.cost;
  const decisions = [];
  let groupsChanged = 0;

  for (const group of groups) {
    let groupBestScene = bestScene;
    let groupBest = best;
    let groupBestOrder = group.ids.slice();
    for (const order of permutations(group.ids)) {
      const candidateScene = reorderGroup(clone(bestScene), group.ids, order);
      const scored = candidateScore(candidateScene, spec);
      if (scored.cost + 0.01 < groupBest.cost) {
        groupBestScene = candidateScene;
        groupBest = scored;
        groupBestOrder = order.slice();
      }
    }
    const changed = groupBestOrder.join('|') !== group.ids.join('|');
    if (changed) groupsChanged += 1;
    decisions.push({
      group: group.key,
      originalOrder: group.ids,
      selectedOrder: groupBestOrder,
      changed,
      costBefore: best.cost,
      costAfter: groupBest.cost
    });
    bestScene = groupBestScene;
    best = groupBest;
  }

  bestScene.customData ??= {};
  bestScene.customData.excalidrawSkill ??= {};
  bestScene.customData.excalidrawSkill.flowOptimization = {
    version: '0.3.0',
    strategy: 'lane-rank-permutation-search',
    scoring: 'shared-post-route-quality-score',
    groupsConsidered: groups.length,
    groupsChanged,
    baselineCost,
    selectedCost: best.cost,
    improvement: Number((baselineCost - best.cost).toFixed(2)),
    decisions
  };
  return bestScene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/optimize-flow-layout.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : scenePath;
  const optimized = optimizeFlowLayout(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, optimized);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    optimization: optimized.customData?.excalidrawSkill?.flowOptimization ?? null
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`optimize-flow-layout failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
