#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boxesOverlap,
  collinearOverlapLength,
  rectOf,
  segmentIntersectsRect,
  segmentsFromEdge,
  segmentsIntersect
} from './geometry.mjs';
import { textElementOverflows } from './text-fit.mjs';
import { createFamilyQualityReport } from './family-quality.mjs';

const VISUAL_ROLES = new Set(['default', 'data-plane', 'control-plane', 'event-stream', 'error-path', 'dependency', 'muted']);
const VISUAL_EMPHASIS = new Set(['normal', 'strong', 'critical', 'muted']);
const VISUAL_STROKES = new Set(['solid', 'dashed', 'dotted']);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`); }
function metaOf(element) { return element.customData?.excalidrawSkill ?? {}; }
function pairKey(first, second) { return [first, second].sort().join('::'); }

function normalizeVisual(value) {
  const visual = value && typeof value === 'object' ? value : {};
  return {
    role: VISUAL_ROLES.has(visual.role) ? visual.role : 'default',
    emphasis: VISUAL_EMPHASIS.has(visual.emphasis) ? visual.emphasis : 'normal',
    stroke: VISUAL_STROKES.has(visual.stroke) ? visual.stroke : undefined
  };
}

function specEdgeId(edge) { return edge.semanticId ?? `${edge.from}_to_${edge.to}`; }

function visualMismatches(edges, spec) {
  const byId = new Map(edges.map((edge) => [metaOf(edge).semanticId, edge]));
  const mismatches = [];
  for (const edgeSpec of spec?.edges ?? []) {
    if (!edgeSpec.visual) continue;
    const id = specEdgeId(edgeSpec);
    const edge = byId.get(id);
    const expected = normalizeVisual(edgeSpec.visual);
    if (!edge) {
      mismatches.push({ edge: id, reason: 'missing-edge', expected });
      continue;
    }
    const meta = metaOf(edge);
    const actual = normalizeVisual(meta.visual);
    const same = expected.role === actual.role && expected.emphasis === actual.emphasis && expected.stroke === actual.stroke;
    if (meta.styleSource !== 'edge.visual' || !same) {
      mismatches.push({ edge: id, reason: 'style-source-or-visual-mismatch', expected, actual, styleSource: meta.styleSource ?? null });
    }
  }
  return mismatches;
}

function endpointSegment(edge, sharedNode) {
  const segments = segmentsFromEdge(edge);
  const meta = metaOf(edge);
  if (meta.from === sharedNode) return segments[0] ?? null;
  if (meta.to === sharedNode) return segments.at(-1) ?? null;
  return null;
}

function nodeSideAtPoint(node, point) {
  const epsilon = 1e-6;
  if (Math.abs(point.y - node.y) < epsilon) return 'up';
  if (Math.abs(point.y - (node.y + node.height)) < epsilon) return 'down';
  if (Math.abs(point.x - node.x) < epsilon) return 'left';
  if (Math.abs(point.x - (node.x + node.width)) < epsilon) return 'right';
  return null;
}

function segmentPerpendicularToSide(segment, side) {
  const vertical = Math.abs(segment.a.x - segment.b.x) < 1e-9;
  const horizontal = Math.abs(segment.a.y - segment.b.y) < 1e-9;
  return side === 'up' || side === 'down' ? vertical : side === 'left' || side === 'right' ? horizontal : false;
}

function segmentPenetratesNodeInterior(segment, node) {
  if (!segment || !node) return false;
  const inset = Math.min(3, Math.max(0, Math.min(node.width, node.height) / 4));
  return segmentIntersectsRect(segment, rectOf(node, -inset), { includeBoundary: false });
}

function emptyFamilyQuality(spec, scene) {
  return { version: '0.1.0', family: null, diagramType: spec?.diagramType ?? null, profile: spec?.layout?.profile ?? scene.customData?.excalidrawSkill?.layout?.profile ?? null, supported: true, reason: null, pass: true, metrics: {}, details: {}, suggestedPatches: [] };
}

export function createQualityReport(scene, spec = null) {
  const nodes = [];
  const edges = [];
  const edgeLabels = [];
  const nodeLabels = [];
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.push(element);
    if (meta.role === 'edge') edges.push(element);
    if (meta.role === 'edge-label') edgeLabels.push(element);
    if (meta.role === 'label') nodeLabels.push(element);
  }

  const nodesById = new Map(nodes.map((node) => [metaOf(node).semanticId, node]));
  const nodeOverlaps = [];
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      if (boxesOverlap(rectOf(nodes[first]), rectOf(nodes[second]))) nodeOverlaps.push([metaOf(nodes[first]).semanticId, metaOf(nodes[second]).semanticId]);
    }
  }

  const edgeNodeCrossings = [];
  for (const edge of edges) {
    const edgeMeta = metaOf(edge);
    for (const node of nodes) {
      const nodeId = metaOf(node).semanticId;
      if (nodeId === edgeMeta.from || nodeId === edgeMeta.to) continue;
      if (segmentsFromEdge(edge).some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) edgeNodeCrossings.push({ edge: edgeMeta.semanticId, node: nodeId });
    }
  }

  const edgeCrossingPairs = new Set();
  const endpointOverlaps = [];
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const firstMeta = metaOf(edges[firstIndex]);
      const secondMeta = metaOf(edges[secondIndex]);
      const sharedNodes = [firstMeta.from, firstMeta.to].filter((id) => id === secondMeta.from || id === secondMeta.to);
      let crosses = false;
      for (const first of segmentsFromEdge(edges[firstIndex])) {
        for (const second of segmentsFromEdge(edges[secondIndex])) {
          if (segmentsIntersect(first, second, { includeEndpoints: false })) crosses = true;
        }
      }
      if (crosses && sharedNodes.length === 0) edgeCrossingPairs.add(pairKey(firstMeta.semanticId, secondMeta.semanticId));
      for (const sharedNode of sharedNodes) {
        const firstSegment = endpointSegment(edges[firstIndex], sharedNode);
        const secondSegment = endpointSegment(edges[secondIndex], sharedNode);
        const overlap = firstSegment && secondSegment ? collinearOverlapLength(firstSegment, secondSegment) : 0;
        if (overlap > 8) endpointOverlaps.push({ node: sharedNode, edges: [firstMeta.semanticId, secondMeta.semanticId], overlap: Number(overlap.toFixed(1)) });
      }
    }
  }

  const labelOverlaps = [];
  for (let first = 0; first < edgeLabels.length; first += 1) {
    for (let second = first + 1; second < edgeLabels.length; second += 1) {
      if (boxesOverlap(rectOf(edgeLabels[first]), rectOf(edgeLabels[second]))) labelOverlaps.push([metaOf(edgeLabels[first]).edge, metaOf(edgeLabels[second]).edge]);
    }
  }

  const labelNodeOverlaps = [];
  for (const label of edgeLabels) {
    for (const node of nodes) if (boxesOverlap(rectOf(label), rectOf(node))) labelNodeOverlaps.push({ edge: metaOf(label).edge, node: metaOf(node).semanticId });
  }

  const textOverflows = [];
  for (const label of nodeLabels) {
    const result = textElementOverflows(label);
    if (result.overflow || metaOf(label).textFit?.overflow) {
      textOverflows.push({ node: metaOf(label).node, estimatedWidth: Number(result.estimatedWidth.toFixed(1)), availableWidth: label.width, requiredHeight: Number(result.requiredHeight.toFixed(1)), availableHeight: label.height, lineCount: result.lineCount });
    }
  }

  const endpointApproachViolations = [];
  const endpointNodePenetrations = [];
  for (const edge of edges) {
    const meta = metaOf(edge);
    const segments = segmentsFromEdge(edge);
    const source = nodesById.get(meta.from);
    const target = nodesById.get(meta.to);
    if (!source || !target || segments.length === 0) continue;
    const first = segments[0];
    const last = segments.at(-1);
    const sourceSide = nodeSideAtPoint(source, first.a);
    const targetSide = nodeSideAtPoint(target, last.b);
    if (!segmentPerpendicularToSide(first, sourceSide)) endpointApproachViolations.push({ edge: meta.semanticId, endpoint: 'source', side: sourceSide });
    if (!segmentPerpendicularToSide(last, targetSide)) endpointApproachViolations.push({ edge: meta.semanticId, endpoint: 'target', side: targetSide });
    if (segmentPenetratesNodeInterior(first, source)) endpointNodePenetrations.push({ edge: meta.semanticId, endpoint: 'source', node: meta.from, side: sourceSide });
    if (segmentPenetratesNodeInterior(last, target)) endpointNodePenetrations.push({ edge: meta.semanticId, endpoint: 'target', node: meta.to, side: targetSide });
  }

  const edgeVisualMismatches = visualMismatches(edges, spec);
  const unresolvedFrameCollisions = Number(scene.customData?.excalidrawSkill?.framePolicy?.unresolvedFrameCollisions ?? 0);
  const minX = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 0;
  const maxX = nodes.length ? Math.max(...nodes.map((node) => node.x + node.width)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map((node) => node.y)) : 0;
  const maxY = nodes.length ? Math.max(...nodes.map((node) => node.y + node.height)) : 0;
  const aspectRatio = Math.max(Math.max(1, maxX - minX) / Math.max(1, maxY - minY), Math.max(1, maxY - minY) / Math.max(1, maxX - minX));

  const structuralMetrics = { nodeOverlaps: nodeOverlaps.length, edgeNodeCrossings: edgeNodeCrossings.length, edgeCrossings: edgeCrossingPairs.size, endpointOverlaps: endpointOverlaps.length, endpointApproachViolations: endpointApproachViolations.length, endpointNodePenetrations: endpointNodePenetrations.length, labelOverlaps: labelOverlaps.length, labelNodeOverlaps: labelNodeOverlaps.length, textOverflows: textOverflows.length, edgeVisualMismatches: edgeVisualMismatches.length, unresolvedFrameCollisions, aspectRatio: Number(aspectRatio.toFixed(2)), nodeCount: nodes.length, edgeCount: edges.length, edgeLabelCount: edgeLabels.length };

  const suggestions = [];
  for (const nodesPair of nodeOverlaps) suggestions.push({ operation: 'move-apart', nodes: nodesPair });
  for (const crossing of edgeNodeCrossings) suggestions.push({ operation: 'reroute-edge', ...crossing });
  for (const overlap of endpointOverlaps) suggestions.push({ operation: 'separate-node-ports', ...overlap });
  for (const violation of endpointApproachViolations) suggestions.push({ operation: 'fix-endpoint-approach', ...violation });
  for (const penetration of endpointNodePenetrations) suggestions.push({ operation: 'reroute-endpoint-outside-node', ...penetration });
  for (const labelsPair of labelOverlaps) suggestions.push({ operation: 'separate-edge-labels', edges: labelsPair });
  for (const overlap of labelNodeOverlaps) suggestions.push({ operation: 'move-edge-label', ...overlap, labelSide: 'auto' });
  for (const overflow of textOverflows) suggestions.push({ operation: 'wrap-or-resize-node-label', ...overflow });
  for (const mismatch of edgeVisualMismatches) suggestions.push({ operation: 'fix-edge-visual', ...mismatch });
  if (unresolvedFrameCollisions > 0) suggestions.push({ operation: 'increase-frame-spacing', unresolvedFrameCollisions });
  if (aspectRatio > 8) suggestions.push({ operation: 'change-layout-aspect', aspectRatio: 'balanced' });

  const structuralPass = structuralMetrics.nodeOverlaps === 0 && structuralMetrics.edgeNodeCrossings === 0 && structuralMetrics.endpointOverlaps === 0 && structuralMetrics.endpointApproachViolations === 0 && structuralMetrics.endpointNodePenetrations === 0 && structuralMetrics.labelOverlaps === 0 && structuralMetrics.labelNodeOverlaps === 0 && structuralMetrics.textOverflows === 0 && structuralMetrics.edgeVisualMismatches === 0 && structuralMetrics.unresolvedFrameCollisions === 0 && structuralMetrics.edgeCrossings <= 2 && structuralMetrics.aspectRatio <= 8;
  const familyQuality = spec ? createFamilyQualityReport(scene, spec) : emptyFamilyQuality(spec, scene);

  return { version: '0.4.2', pass: structuralPass && familyQuality.pass, structuralPass, familyPass: familyQuality.pass, diagramType: spec?.diagramType ?? null, layoutProfile: spec?.layout?.profile ?? scene.customData?.excalidrawSkill?.layout?.profile ?? null, metrics: { ...structuralMetrics, ...familyQuality.metrics }, details: { nodeOverlaps, edgeNodeCrossings, edgeCrossings: [...edgeCrossingPairs], endpointOverlaps, endpointApproachViolations, endpointNodePenetrations, labelOverlaps, labelNodeOverlaps, textOverflows, edgeVisualMismatches, unresolvedFrameCollisions, family: familyQuality.details }, familyQuality, suggestedPatches: [...suggestions, ...familyQuality.suggestedPatches] };
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
  console.log(JSON.stringify({ outputPath: path.relative(process.cwd(), outputPath) || outputPath, pass: report.pass, structuralPass: report.structuralPass, familyPass: report.familyPass, metrics: report.metrics }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try { main(); } catch (error) { console.error(`quality-report failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
