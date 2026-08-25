#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rectOf, segmentIntersectsRect, segmentsFromEdge } from './geometry.mjs';

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

function endpointInset(node) {
  return Math.min(3, Math.max(0.5, Math.min(Number(node?.width ?? 0), Number(node?.height ?? 0)) / 4));
}

export function segmentPenetratesNodeInterior(segment, node) {
  if (!segment || !node) return false;
  return segmentIntersectsRect(segment, rectOf(node, -endpointInset(node)), { includeBoundary: false });
}

export function endpointNodePenetrationsForEdge(edge, nodes) {
  const edgeMeta = metaOf(edge);
  const segments = segmentsFromEdge(edge);
  const result = [];
  if (segments.length === 0) return result;

  for (const [endpoint, nodeId] of [['source', edgeMeta.from], ['target', edgeMeta.to]]) {
    const node = nodes.get(nodeId);
    if (!node) continue;
    const penetratingSegments = [];
    segments.forEach((segment, index) => {
      if (segmentPenetratesNodeInterior(segment, node)) penetratingSegments.push(index);
    });
    if (penetratingSegments.length > 0) {
      result.push({
        edge: edgeMeta.semanticId,
        endpoint,
        node: nodeId,
        penetratingSegments
      });
    }
  }
  return result;
}

export function createRouteIntegrityReport(scene) {
  const nodes = new Map();
  const edges = [];
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node' && typeof meta.semanticId === 'string') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }

  const endpointNodePenetrations = edges.flatMap((edge) => endpointNodePenetrationsForEdge(edge, nodes));
  return {
    version: '0.1.0',
    pass: endpointNodePenetrations.length === 0,
    metrics: {
      endpointNodePenetrations: endpointNodePenetrations.length,
      edgeCount: edges.length,
      nodeCount: nodes.size
    },
    details: {
      endpointNodePenetrations
    }
  };
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/route-integrity.mjs <scene.excalidraw> [-o report.json]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : `${scenePath}.route-integrity.json`;
  const report = createRouteIntegrityReport(readJson(scenePath));
  writeJson(outputPath, report);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    pass: report.pass,
    metrics: report.metrics
  }, null, 2));
  if (!report.pass) process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`route-integrity failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
