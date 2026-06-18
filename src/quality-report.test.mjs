import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualityReport } from './quality-report.mjs';
function node(id, x, y) { return { id: `node_${id}`, type: 'rectangle', x, y, width: 100, height: 60, customData: { excalidrawSkill: { role: 'node', semanticId: id } } }; }
function edge(id, from, to, x, y, points) { const last = points.at(-1); return { id: `edge_${id}`, type: 'arrow', x, y, width: last[0], height: last[1], points, customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } } }; }
function edgeLabel(id, x, y) { return { id: `label_${id}`, type: 'text', x, y, width: 80, height: 20, customData: { excalidrawSkill: { role: 'edge-label', edge: id } } }; }
function nodeLabel(id, text, x, y, width = 80, height = 24) { return { id: `node_label_${id}`, type: 'text', text, x, y, width, height, fontSize: 18, lineHeight: 1.25, customData: { excalidrawSkill: { role: 'label', node: id } } }; }

test('passes a clean compact scene', () => { const a = node('a', 0, 0); const b = node('b', 300, 0); const e = edge('a-b', 'a', 'b', 100, 30, [[0, 0], [200, 0]]); const l = edgeLabel('a-b', 160, 0); const report = createQualityReport({ elements: [a, b, e, l] }, { diagramType: 'service-flow', layout: { profile: 'layered-flow' } }); assert.equal(report.pass, true); });

test('reports text overflow', () => { const a = node('a', 0, 0); const label = nodeLabel('a', 'Payment Events Topic', 10, 10, 80, 24); const report = createQualityReport({ elements: [a, label] }); assert.equal(report.metrics.textOverflows, 1); assert.ok(report.suggestedPatches.some((patch) => patch.operation === 'wrap-or-resize-node-label')); });

test('reports overlapping endpoint segments', () => { const a = node('a', 0, 0); const b = node('b', 300, -80); const c = node('c', 300, 80); const first = edge('a-b', 'a', 'b', 100, 30, [[0, 0], [40, 0], [200, -80]]); const second = edge('a-c', 'a', 'c', 100, 30, [[0, 0], [40, 0], [200, 80]]); const report = createQualityReport({ elements: [a, b, c, first, second] }); assert.equal(report.metrics.endpointOverlaps, 1); });

test('reports target-boundary following instead of perpendicular entry', () => { const a = node('a', 0, 0); const b = node('b', 0, 200); const e = edge('a-b', 'a', 'b', 50, 60, [[0, 0], [-20, 140], [0, 140]]); const report = createQualityReport({ elements: [a, b, e] }); assert.ok(report.metrics.endpointApproachViolations > 0); });
