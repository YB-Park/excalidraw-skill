#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ELK from 'elkjs/lib/elk.bundled.js';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element.customData?.excalidrawSkill ?? {};
}

function edgeId(edge) {
  return edge.semanticId ?? `${edge.from}_to_${edge.to}`;
}

function opposite(side) {
  return ({ EAST: 'WEST', WEST: 'EAST', NORTH: 'SOUTH', SOUTH: 'NORTH' })[side];
}

function sourceSideFor(edge, primaryPairs) {
  const direction = edge.routeHints?.direction;
  if (direction === 'right') return 'EAST';
  if (direction === 'left') return 'WEST';
  if (direction === 'down') return 'SOUTH';
  if (direction === 'up') return 'NORTH';
  if (primaryPairs.has(`${edge.from}->${edge.to}`) || edge.routeHints?.priority === 'primary') return 'EAST';
  return null;
}

function primaryPairSet(spec) {
  const primary = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let index = 0; index < primary.length - 1; index += 1) {
    pairs.add(`${primary[index]}->${primary[index + 1]}`);
  }
  return pairs;
}

function laneOrderMap(spec) {
  const lanes = [...(spec?.layout?.lanes ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return new Map(lanes.map((lane, index) => [lane.id, index]));
}

function rankFor(node, spec) {
  if (Number.isFinite(node.layoutHints?.rank)) return Math.max(0, Math.round(node.layoutHints.rank));
  const primary = spec?.layout?.primaryFlow ?? [];
  const primaryIndex = primary.indexOf(node.semanticId);
  return primaryIndex >= 0 ? primaryIndex : 0;
}

export function toElkGraph(scene, spec, options = {}) {
  const semanticNodes = new Map();
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') semanticNodes.set(meta.semanticId, element);
  }
  const primaryPairs = primaryPairSet(spec);
  const laneOrders = laneOrderMap(spec);
  const nodeSpecs = [...(spec?.nodes ?? [])].sort((first, second) => {
    const laneDelta = (laneOrders.get(first.layoutHints?.lane) ?? 999)
      - (laneOrders.get(second.layoutHints?.lane) ?? 999);
    return laneDelta || rankFor(first, spec) - rankFor(second, spec)
      || first.semanticId.localeCompare(second.semanticId);
  });

  const portsByNode = new Map(nodeSpecs.map((node) => [node.semanticId, []]));
  const edges = [];
  for (const edge of spec?.edges ?? []) {
    const id = edgeId(edge);
    const sourceSide = sourceSideFor(edge, primaryPairs);
    const targetSide = sourceSide ? opposite(sourceSide) : null;
    let source = edge.from;
    let target = edge.to;
    if (sourceSide && portsByNode.has(edge.from) && portsByNode.has(edge.to)) {
      const sourcePort = `port:${id}:source`;
      const targetPort = `port:${id}:target`;
      portsByNode.get(edge.from).push({
        id: sourcePort,
        width: 2,
        height: 2,
        layoutOptions: { 'elk.port.side': sourceSide }
      });
      portsByNode.get(edge.to).push({
        id: targetPort,
        width: 2,
        height: 2,
        layoutOptions: { 'elk.port.side': targetSide }
      });
      source = sourcePort;
      target = targetPort;
    }
    edges.push({
      id,
      sources: [source],
      targets: [target],
      layoutOptions: {
        'elk.layered.priority.straightness': primaryPairs.has(`${edge.from}->${edge.to}`)
          || edge.routeHints?.priority === 'primary'
          ? '20'
          : '2'
      }
    });
  }

  const children = nodeSpecs.map((nodeSpec) => {
    const element = semanticNodes.get(nodeSpec.semanticId);
    const ports = portsByNode.get(nodeSpec.semanticId) ?? [];
    return {
      id: nodeSpec.semanticId,
      width: element?.width ?? 180,
      height: element?.height ?? 80,
      ports,
      layoutOptions: {
        'elk.partitioning.partition': String(rankFor(nodeSpec, spec)),
        ...(ports.length > 0 ? { 'elk.portConstraints': 'FIXED_SIDE' } : {})
      }
    };
  });

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': options.direction ?? 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.partitioning.activate': 'true',
      'elk.layered.considerModelOrder.strategy': 'PREFER_NODES',
      'elk.layered.crossingMinimization.strategy': options.crossingStrategy ?? 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
      'elk.layered.nodePlacement.strategy': options.nodePlacement ?? 'BRANDES_KOEPF',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
      'elk.layered.nodePlacement.bk.edgeStraightening': 'IMPROVE_STRAIGHTNESS',
      'elk.layered.portSortingStrategy': 'PORT_DEGREE',
      'elk.spacing.nodeNode': String(options.nodeSpacing ?? 64),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.layerSpacing ?? 110),
      'elk.layered.spacing.edgeNodeBetweenLayers': String(options.edgeNodeSpacing ?? 32),
      'elk.layered.spacing.edgeEdgeBetweenLayers': String(options.edgeSpacing ?? 18),
      'elk.spacing.portPort': String(options.portSpacing ?? 16),
      'elk.randomSeed': '1'
    },
    children,
    edges
  };
}

function moveNodeAndLabel(scene, semanticId, x, y) {
  const node = (scene.elements ?? []).find((element) => {
    const meta = metaOf(element);
    return meta.role === 'node' && meta.semanticId === semanticId;
  });
  if (!node) return;
  const dx = x - node.x;
  const dy = y - node.y;
  node.x = x;
  node.y = y;
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'label' && meta.node === semanticId) {
      element.x += dx;
      element.y += dy;
    }
  }
}

function applyElkEdge(scene, elkEdge, semanticId, offsetX, offsetY) {
  const edge = (scene.elements ?? []).find((element) => {
    const meta = metaOf(element);
    return meta.role === 'edge' && meta.semanticId === semanticId;
  });
  const section = elkEdge?.sections?.[0];
  if (!edge || !section?.startPoint || !section?.endPoint) return;
  const absolute = [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint
  ].map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
  edge.x = absolute[0].x;
  edge.y = absolute[0].y;
  edge.points = absolute.map((point) => [point.x - edge.x, point.y - edge.y]);
  const last = edge.points.at(-1);
  edge.width = last[0];
  edge.height = last[1];
  const meta = metaOf(edge);
  meta.route = {
    engine: 'elk-layered-research-v0.1',
    bends: Math.max(0, absolute.length - 2)
  };
}

export async function layoutElkFlow(scene, spec, options = {}) {
  const graph = toElkGraph(scene, spec, options);
  const elk = new ELK();
  const result = await elk.layout(graph);
  const offsetX = options.originX ?? 120;
  const offsetY = options.originY ?? 120;
  for (const child of result.children ?? []) {
    moveNodeAndLabel(scene, child.id, child.x + offsetX, child.y + offsetY);
  }
  for (const elkEdge of result.edges ?? []) {
    applyElkEdge(scene, elkEdge, elkEdge.id, offsetX, offsetY);
  }
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layoutResearch = {
    engine: 'elk-layered',
    options: graph.layoutOptions
  };
  return scene;
}

async function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/layout-elk-flow.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : scenePath;
  const scene = await layoutElkFlow(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, scene);
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`layout-elk-flow failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
