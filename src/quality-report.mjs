#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxesOverlap, collinearOverlapLength, rectOf, segmentIntersectsRect, segmentsFromEdge, segmentsIntersect } from './geometry.mjs';
import { textElementOverflows } from './text-fit.mjs';
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, data) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`); }
function metaOf(element) { return element.customData?.excalidrawSkill ?? {}; }
function pairKey(first, second) { return [first, second].sort().join('::'); }
function endpointSegment(edge, sharedNode) { const segments = segmentsFromEdge(edge); const meta = metaOf(edge); if (meta.from === sharedNode) return segments[0] ?? null; if (meta.to === sharedNode) return segments.at(-1) ?? null; return null; }
function nodeSideAtPoint(node, point) { const epsilon = 1e-6; if (Math.abs(point.y - node.y) < epsilon) return 'up'; if (Math.abs(point.y - (node.y + node.height)) < epsilon) return 'down'; if (Math.abs(point.x - node.x) < epsilon) return 'left'; if (Math.abs(point.x - (node.x + node.width)) < epsilon) return 'right'; return null; }
function segmentPerpendicularToSide(segment, side) { const vertical = Math.abs(segment.a.x - segment.b.x) < 1e-9; const horizontal = Math.abs(segment.a.y - segment.b.y) < 1e-9; return side === 'up' || side === 'down' ? vertical : side === 'left' || side === 'right' ? horizontal : false; }
export function createQualityReport(scene, spec = null) {
  const nodes = []; const edges = []; const edgeLabels = []; const nodeLabels = [];
  for (const element of scene.elements ?? []) { const meta = metaOf(element); if (meta.role === 'node') nodes.push(element); if (meta.role === 'edge') edges.push(element); if (meta.role === 'edge-label') edgeLabels.push(element); if (meta.role === 'label') nodeLabels.push(element); }
  const nodesById = new Map(nodes.map((node) => [metaOf(node).semanticId, node]));
  const nodeOverlaps = [];
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) if (boxesOverlap(rectOf(nodes[i]), rectOf(nodes[j]))) nodeOverlaps.push([metaOf(nodes[i]).semanticId, metaOf(nodes[j]).semanticId]);
  const edgeNodeCrossings = [];
  for (const edge of edges) { const edgeMeta = metaOf(edge); for (const node of nodes) { const nodeId = metaOf(node).semanticId; if (nodeId === edgeMeta.from || nodeId === edgeMeta.to) continue; if (segmentsFromEdge(edge).some((segment) => segmentIntersectsRect(segment, rectOf(node, 3)))) edgeNodeCrossings.push({ edge: edgeMeta.semanticId, node: nodeId }); } }
  const edgeCrossingPairs = new Set(); const endpointOverlaps = [];
  for (let i = 0; i < edges.length; i += 1) for (let j = i + 1; j < edges.length; j += 1) { const firstMeta = metaOf(edges[i]); const secondMeta = metaOf(edges[j]); const sharedNodes = [firstMeta.from, firstMeta.to].filter((id) => id === secondMeta.from || id === secondMeta.to); let crosses = false; for (const first of segmentsFromEdge(edges[i])) for (const second of segmentsFromEdge(edges[j])) if (segmentsIntersect(first, second, { includeEndpoints: false })) crosses = true; if (crosses && sharedNodes.length === 0) edgeCrossingPairs.add(pairKey(firstMeta.semanticId, secondMeta.semanticId)); for (const sharedNode of sharedNodes) { const firstSegment = endpointSegment(edges[i], sharedNode); const secondSegment = endpointSegment(edges[j], sharedNode); const overlap = firstSegment && secondSegment ? collinearOverlapLength(firstSegment, secondSegment) : 0; if (overlap > 8) endpointOverlaps.push({ node: sharedNode, edges: [firstMeta.semanticId, secondMeta.semanticId], overlap: Number(overlap.toFixed(1)) }); } }
  const labelOverlaps = [];
  for (let i = 0; i < edgeLabels.length; i += 1) for (let j = i + 1; j < edgeLabels.length; j += 1) if (boxesOverlap(rectOf(edgeLabels[i]), rectOf(edgeLabels[j]))) labelOverlaps.push([metaOf(edgeLabels[i]).edge, metaOf(edgeLabels[j]).edge]);
  const labelNodeOverlaps = [];
  for (const label of edgeLabels) for (const node of nodes) if (boxesOverlap(rectOf(label), rectOf(node))) labelNodeOverlaps.push({ edge: metaOf(label).edge, node: metaOf(node).semanticId });
  const textOverflows = [];
  for (const label of nodeLabels) { const result = textElementOverflows(label); if (result.overflow || metaOf(label).textFit?.overflow) textOverflows.push({ node: metaOf(label).node, estimatedWidth: Number(result.estimatedWidth.toFixed(1)), availableWidth: label.width, requiredHeight: Number(result.requiredHeight.toFixed(1)), availableHeight: label.height, lineCount: result.lineCount }); }
  const endpointApproachViolations = [];
  for (const edge of edges) { const meta = metaOf(edge); const segments = segmentsFromEdge(edge); const source = nodesById.get(meta.from); const target = nodesById.get(meta.to); if (!source || !target || segments.length === 0) continue; const first = segments[0]; const last = segments.at(-1); const sourceSide = nodeSideAtPoint(source, first.a); const targetSide = nodeSideAtPoint(target, last.b); if (!segmentPerpendicularToSide(first, sourceSide)) endpointApproachViolations.push({ edge: meta.semanticId, endpoint: 'source', side: sourceSide }); if (!segmentPerpendicularToSide(last, targetSide)) endpointApproachViolations.push({ edge: meta.semanticId, endpoint: 'target', side: targetSide }); }
  const minX = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 0; const maxX = nodes.length ? Math.max(...nodes.map((node) => node.x + node.width)) : 0; const minY = nodes.length ? Math.min(...nodes.map((node) => node.y)) : 0; const maxY = nodes.length ? Math.max(...nodes.map((node) => node.y + node.height)) : 0; const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY); const aspectRatio = Math.max(width / height, height / width);
  const metrics = { nodeOverlaps: nodeOverlaps.length, edgeNodeCrossings: edgeNodeCrossings.length, edgeCrossings: edgeCrossingPairs.size, endpointOverlaps: endpointOverlaps.length, endpointApproachViolations: endpointApproachViolations.length, labelOverlaps: labelOverlaps.length, labelNodeOverlaps: labelNodeOverlaps.length, textOverflows: textOverflows.length, aspectRatio: Number(aspectRatio.toFixed(2)), nodeCount: nodes.length, edgeCount: edges.length, edgeLabelCount: edgeLabels.length };
  const suggestions = [];
  for (const nodesPair of nodeOverlaps) suggestions.push({ operation: 'move-apart', nodes: nodesPair });
  for (const crossing of edgeNodeCrossings) suggestions.push({ operation: 'reroute-edge', ...crossing });
  for (const overlap of endpointOverlaps) suggestions.push({ operation: 'separate-node-ports', ...overlap });
  for (const violation of endpointApproachViolations) suggestions.push({ operation: 'fix-endpoint-approach', ...violation });
  for (const labelsPair of labelOverlaps) suggestions.push({ operation: 'separate-edge-labels', edges: labelsPair });
  for (const overlap of labelNodeOverlaps) suggestions.push({ operation: 'move-edge-label', ...overlap, labelSide: 'auto' });
  for (const overflow of textOverflows) suggestions.push({ operation: 'wrap-or-resize-node-label', ...overflow });
  if (aspectRatio > 8) suggestions.push({ operation: 'change-layout-aspect', aspectRatio: 'balanced' });
  const pass = metrics.nodeOverlaps === 0 && metrics.edgeNodeCrossings === 0 && metrics.endpointOverlaps === 0 && metrics.endpointApproachViolations === 0 && metrics.labelOverlaps === 0 && metrics.labelNodeOverlaps === 0 && metrics.textOverflows === 0 && metrics.edgeCrossings <= 2 && metrics.aspectRatio <= 8;
  return { version: '0.3.1', pass, diagramType: spec?.diagramType ?? null, layoutProfile: spec?.layout?.profile ?? scene.customData?.excalidrawSkill?.layout?.profile ?? null, metrics, details: { nodeOverlaps, edgeNodeCrossings, edgeCrossings: [...edgeCrossingPairs], endpointOverlaps, endpointApproachViolations, labelOverlaps, labelNodeOverlaps, textOverflows }, suggestedPatches: suggestions };
}
function main() { const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2); if (!scenePathArg) { console.error('Usage: node src/quality-report.mjs <scene.excalidraw> [spec.json] [-o report.json]'); process.exit(1); } const scenePath = path.resolve(process.cwd(), scenePathArg); const specPath = specPathArg && specPathArg !== '-o' ? path.resolve(process.cwd(), specPathArg) : null; const actualFlag = specPath ? flag : specPathArg; const actualOutput = specPath ? outputPathArg : flag; const outputPath = actualFlag === '-o' && actualOutput ? path.resolve(process.cwd(), actualOutput) : `${scenePath}.quality.json`; const report = createQualityReport(readJson(scenePath), specPath ? readJson(specPath) : null); writeJson(outputPath, report); console.log(JSON.stringify({ outputPath: path.relative(process.cwd(), outputPath) || outputPath, pass: report.pass, metrics: report.metrics }, null, 2)); }
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url); if (isMain) { try { main(); } catch (error) { console.error(`quality-report failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); } }
