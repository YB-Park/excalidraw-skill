#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxesOverlap, rectOf, segmentIntersectsRect, segmentsFromEdge, segmentsIntersect } from './geometry.mjs';

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`); }
function metaOf(element) { return element.customData?.excalidrawSkill ?? {}; }
function pairKey(first, second) { return [first, second].sort().join('::'); }

export function createQualityReport(scene, spec = null) {
  const nodes = [];
  const edges = [];
  const labels = [];
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.push(element);
    if (meta.role === 'edge') edges.push(element);
    if (meta.role === 'edge-label') labels.push(element);
  }

  const nodeOverlaps = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (boxesOverlap(rectOf(nodes[i]), rectOf(nodes[j]))) nodeOverlaps.push([metaOf(nodes[i]).semanticId, metaOf(nodes[j]).semanticId]);
    }
  }

  const edgeNodeCrossings = [];
  for (const edge of edges) {
    const edgeMeta = metaOf(edge);
    for (const node of nodes) {
      const nodeId = metaOf(node).semanticId;
      if (nodeId === edgeMeta.from || nodeId === edgeMeta.to) continue;
      if (segmentsFromEdge(edge).some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) {
        edgeNodeCrossings.push({ edge: edgeMeta.semanticId, node: nodeId });
      }
    }
  }

  const edgeCrossingPairs = new Set();
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const firstMeta = metaOf(edges[i]); const secondMeta = metaOf(edges[j]);
      const sharesNode = [firstMeta.from, firstMeta.to].some((id) => id === secondMeta.from || id === secondMeta.to);
      let crosses = false;
      for (const first of segmentsFromEdge(edges[i])) {
        for (const second of segmentsFromEdge(edges[j])) {
          if (segmentsIntersect(first, second, { includeEndpoints: false })) crosses = true;
        }
      }
      if (crosses && !sharesNode) edgeCrossingPairs.add(pairKey(firstMeta.semanticId, secondMeta.semanticId));
    }
  }

  const labelOverlaps = [];
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      if (boxesOverlap(rectOf(labels[i]), rectOf(labels[j]))) labelOverlaps.push([metaOf(labels[i]).edge, metaOf(labels[j]).edge]);
    }
  }

  const labelNodeOverlaps = [];
  for (const label of labels) {
    for (const node of nodes) {
      if (boxesOverlap(rectOf(label), rectOf(node))) labelNodeOverlaps.push({ edge: metaOf(label).edge, node: metaOf(node).semanticId });
    }
  }

  const minX = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 0;
  const maxX = nodes.length ? Math.max(...nodes.map((node) => node.x + node.width)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map((node) => node.y)) : 0;
  const maxY = nodes.length ? Math.max(...nodes.map((node) => node.y + node.height)) : 0;
  const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY);
  const aspectRatio = Math.max(width / height, height / width);

  const metrics = {
    nodeOverlaps: nodeOverlaps.length,
    edgeNodeCrossings: edgeNodeCrossings.length,
    edgeCrossings: edgeCrossingPairs.size,
    labelOverlaps: labelOverlaps.length,
    labelNodeOverlaps: labelNodeOverlaps.length,
    aspectRatio: Number(aspectRatio.toFixed(2)),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    edgeLabelCount: labels.length
  };

  const suggestions = [];
  for (const nodesPair of nodeOverlaps) suggestions.push({ operation: 'move-apart', nodes: nodesPair });
  for (const crossing of edgeNodeCrossings) suggestions.push({ operation: 'reroute-edge', ...crossing });
  for (const labelsPair of labelOverlaps) suggestions.push({ operation: 'separate-edge-labels', edges: labelsPair });
  for (const overlap of labelNodeOverlaps) suggestions.push({ operation: 'move-edge-label', ...overlap, labelSide: 'auto' });
  if (aspectRatio > 8) suggestions.push({ operation: 'change-layout-aspect', aspectRatio: 'balanced' });

  const pass = metrics.nodeOverlaps === 0
    && metrics.edgeNodeCrossings === 0
    && metrics.labelOverlaps === 0
    && metrics.labelNodeOverlaps === 0
    && metrics.edgeCrossings <= 2
    && metrics.aspectRatio <= 8;

  return {
    version: '0.3',
    pass,
    diagramType: spec?.diagramType ?? null,
    layoutProfile: spec?.layout?.profile ?? scene.customData?.excalidrawSkill?.layout?.profile ?? null,
    metrics,
    details: { nodeOverlaps, edgeNodeCrossings, edgeCrossings: [...edgeCrossingPairs], labelOverlaps, labelNodeOverlaps },
    suggestedPatches: suggestions
  };
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) { console.error('Usage: node src/quality-report.mjs <scene.excalidraw> [spec.json] [-o report.json]'); process.exit(1); }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = specPathArg && specPathArg !== '-o' ? path.resolve(process.cwd(), specPathArg) : null;
  const actualFlag = specPath ? flag : specPathArg;
  const actualOutput = specPath ? outputPathArg : flag;
  const outputPath = actualFlag === '-o' && actualOutput ? path.resolve(process.cwd(), actualOutput) : `${scenePath}.quality.json`;
  const report = createQualityReport(readJson(scenePath), specPath ? readJson(specPath) : null);
  writeJson(outputPath, report);
  console.log(JSON.stringify({ outputPath: path.relative(process.cwd(), outputPath) || outputPath, pass: report.pass, metrics: report.metrics }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try { main(); } catch (error) { console.error(`quality-report failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
