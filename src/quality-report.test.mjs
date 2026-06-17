import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualityReport } from './quality-report.mjs';

function node(id, x, y) { return { id: `node_${id}`, type: 'rectangle', x, y, width: 100, height: 60, customData: { excalidrawSkill: { role: 'node', semanticId: id } } }; }
function edge(id, from, to, x, y, points) { const last = points.at(-1); return { id: `edge_${id}`, type: 'arrow', x, y, width: last[0], height: last[1], points, customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } } }; }
function label(id, x, y) { return { id: `label_${id}`, type: 'text', x, y, width: 80, height: 20, customData: { excalidrawSkill: { role: 'edge-label', edge: id } } }; }

test('passes a clean compact scene', () => {
  const a = node('a', 0, 0); const b = node('b', 300, 0); const e = edge('a-b', 'a', 'b', 100, 30, [[0, 0], [200, 0]]); const l = label('a-b', 160, 0);
  const report = createQualityReport({ elements: [a, b, e, l] }, { diagramType: 'service-flow', layout: { profile: 'layered-flow' } });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.edgeNodeCrossings, 0);
  assert.equal(report.metrics.labelOverlaps, 0);
});

test('reports structural collisions and patch suggestions', () => {
  const a = node('a', 0, 0); const b = node('b', 50, 0); const blocker = node('blocker', 200, 0); const e = edge('a-b', 'a', 'b', 100, 30, [[0, 0], [200, 0]]); const l1 = label('a-b', 20, 10); const l2 = label('other', 30, 10);
  const report = createQualityReport({ elements: [a, b, blocker, e, l1, l2] });
  assert.equal(report.pass, false);
  assert.ok(report.metrics.nodeOverlaps > 0);
  assert.ok(report.metrics.edgeNodeCrossings > 0);
  assert.ok(report.metrics.labelOverlaps > 0);
  assert.ok(report.suggestedPatches.length > 0);
});
