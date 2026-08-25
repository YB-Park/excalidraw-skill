#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { absolutePoints } from './geometry.mjs';
import { scoreLayoutCandidate } from './layout-score.mjs';

const FLOW_TYPES = new Set(['flow', 'service-flow', 'event-flow', 'data-flow']);
const MIN_IMPROVEMENT = 6;

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function edgeId(edge) {
  return edge.semanticId ?? `${edge.from}_to_${edge.to}`;
}

function pointOnSide(node, side, fraction = 0.5) {
  if (side === 'up') return { x: node.x + node.width * fraction, y: node.y };
  if (side === 'down') return { x: node.x + node.width * fraction, y: node.y + node.height };
  if (side === 'left') return { x: node.x, y: node.y + node.height * fraction };
  return { x: node.x + node.width, y: node.y + node.height * fraction };
}

function dedupe(points) {
  const result = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && last.x === point.x && last.y === point.y) continue;
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

function setEdgePoints(edge, points) {
  const first = points[0];
  edge.x = first.x;
  edge.y = first.y;
  edge.points = points.map((point) => [point.x - first.x, point.y - first.y]);
  const last = edge.points.at(-1) ?? [0, 0];
  edge.width = last[0];
  edge.height = last[1];
}

function candidateRoutes(source, target) {
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetRight = targetCenterX >= sourceCenterX;
  const sourceFractions = targetRight ? [0.9, 0.8, 0.7, 0.5] : [0.1, 0.2, 0.3, 0.5];
  const targetSide = targetRight ? 'left' : 'right';
  const targetFractions = [0.5, 0.35, 0.65];
  const shelfY = (source.y + source.height + target.y) / 2;
  const candidates = [];

  for (const sourceFraction of sourceFractions) {
    const start = pointOnSide(source, 'down', sourceFraction);
    for (const targetFraction of targetFractions) {
      const lateralEnd = pointOnSide(target, targetSide, targetFraction);
      candidates.push({
        sourceSide: 'down',
        targetSide,
        sourceFraction,
        targetFraction,
        strategy: 'down-then-lateral',
        points: dedupe([start, { x: start.x, y: lateralEnd.y }, lateralEnd])
      });
    }

    const topEnd = pointOnSide(target, 'up', 0.5);
    candidates.push({
      sourceSide: 'down',
      targetSide: 'up',
      sourceFraction,
      targetFraction: 0.5,
      strategy: 'between-row-shelf',
      points: dedupe([
        start,
        { x: start.x, y: shelfY },
        { x: topEnd.x, y: shelfY },
        topEnd
      ])
    });
  }
  return candidates;
}

export function repairFlowSupportRoutes(scene, spec) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (!FLOW_TYPES.has(spec?.diagramType)) return scene;

  const nodes = new Map();
  const edges = new Map();
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && meta.semanticId) nodes.set(meta.semanticId, element);
    if (meta.role === 'edge' && meta.semanticId) edges.set(meta.semanticId, element);
  }

  let currentScore = scoreLayoutCandidate(scene, spec);
  const decisions = [];
  for (const specEdge of spec.edges ?? []) {
    if (specEdge.routeHints?.priority === 'primary') continue;
    if (specEdge.routeHints?.direction !== 'down') continue;
    const id = edgeId(specEdge);
    const edge = edges.get(id);
    const source = nodes.get(specEdge.from);
    const target = nodes.get(specEdge.to);
    if (!edge || !source || !target) continue;
    const currentPoints = absolutePoints(edge);
    const currentBends = Math.max(0, currentPoints.length - 2);
    if (currentBends < 3) continue;
    if (target.y <= source.y + source.height) continue;

    const trials = [];
    for (const proposal of candidateRoutes(source, target)) {
      const candidateScene = clone(scene);
      const candidateEdge = candidateScene.elements.find((element) => metaOf(element).role === 'edge' && metaOf(element).semanticId === id);
      if (!candidateEdge) continue;
      setEdgePoints(candidateEdge, proposal.points);
      const route = metaOf(candidateEdge).route ??= {};
      route.sourceSide = proposal.sourceSide;
      route.targetSide = proposal.targetSide;
      route.bends = Math.max(0, proposal.points.length - 2);
      const score = scoreLayoutCandidate(candidateScene, spec);
      trials.push({ proposal, score, candidateScene });
    }

    trials.sort((a, b) => a.score.hardPenalty - b.score.hardPenalty
      || a.score.cost - b.score.cost
      || a.proposal.points.length - b.proposal.points.length);
    const best = trials[0];
    const improvement = best ? currentScore.cost - best.score.cost : 0;
    const accepted = Boolean(best
      && best.score.hardPass
      && best.score.hardPenalty <= currentScore.hardPenalty
      && best.score.cost <= currentScore.cost - MIN_IMPROVEMENT
      && best.proposal.points.length < currentPoints.length);

    decisions.push({
      edge: id,
      considered: trials.length,
      accepted,
      previousBends: currentBends,
      previousCost: currentScore.cost,
      selectedStrategy: best?.proposal.strategy ?? null,
      nextBends: best ? Math.max(0, best.proposal.points.length - 2) : null,
      nextCost: best?.score.cost ?? null,
      hardPenaltyAfter: best?.score.hardPenalty ?? null,
      improvement: Number(Math.max(0, improvement).toFixed(2))
    });
    if (!accepted) continue;

    const chosenEdge = best.candidateScene.elements.find((element) => metaOf(element).role === 'edge' && metaOf(element).semanticId === id);
    setEdgePoints(edge, absolutePoints(chosenEdge));
    const route = metaOf(edge).route ??= {};
    route.sourceSide = best.proposal.sourceSide;
    route.targetSide = best.proposal.targetSide;
    route.bends = Math.max(0, best.proposal.points.length - 2);
    metaOf(edge).supportRouteRepair = {
      engine: 'flow-support-route-v0.1',
      strategy: best.proposal.strategy,
      sourceFraction: best.proposal.sourceFraction,
      targetFraction: best.proposal.targetFraction,
      improvement: Number(improvement.toFixed(2))
    };
    currentScore = best.score;
  }

  if (decisions.length > 0) {
    scene.customData ??= {};
    scene.customData.excalidrawSkill ??= {};
    scene.customData.excalidrawSkill.supportRouteRepair = {
      version: '0.1.0',
      strategy: 'hard-gated-downward-support-local-search',
      considered: decisions.length,
      accepted: decisions.filter((decision) => decision.accepted).length,
      finalCost: currentScore.cost,
      decisions
    };
  }
  return scene;
}

function main() {
  const [sceneArg, specArg, flag, outputArg] = process.argv.slice(2);
  if (!sceneArg || !specArg) throw new Error('Usage: node src/repair-flow-support-routes.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
  const scenePath = path.resolve(process.cwd(), sceneArg);
  const specPath = path.resolve(process.cwd(), specArg);
  const outputPath = flag === '-o' && outputArg ? path.resolve(process.cwd(), outputArg) : scenePath;
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(repairFlowSupportRoutes(scene, spec), null, 2)}\n`);
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`repair-flow-support-routes failed: ${error.message}`); process.exit(1); }
}
