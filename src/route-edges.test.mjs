import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEdges } from './route-edges.mjs';
import { rectOf, segmentIntersectsRect, segmentsFromEdge } from './geometry.mjs';

function node(id, x, y) {
  return { id: `node_${id}`, type: 'rectangle', x, y, width: 180, height: 80, customData: { excalidrawSkill: { role: 'node', semanticId: id } } };
}
function edge(id, from, to) {
  return { id: `edge_${id}`, type: 'arrow', x: 0, y: 0, width: 0, height: 0, points: [[0, 0], [0, 0]], customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, kind: 'sync' } } };
}

test('routes around blocking nodes', () => {
  const a = node('a', 0, 0); const blocker = node('blocker', 300, 0); const b = node('b', 600, 0); const e = edge('a-b', 'a', 'b');
  routeEdges({ elements: [a, blocker, b, e] }, { layout: { primaryFlow: ['a', 'b'] }, edges: [{ semanticId: 'a-b', from: 'a', to: 'b', routeHints: { priority: 'primary', direction: 'right' } }] });
  assert.ok(e.points.length >= 4);
  assert.ok(segmentsFromEdge(e).every((segment) => !segmentIntersectsRect(segment, rectOf(blocker, 10))));
  assert.equal(e.customData.excalidrawSkill.route.engine, 'graph-aware-v0.3');
});

test('separates ports for multiple edges from the same side', () => {
  const a = node('a', 0, 100); const b = node('b', 500, 0); const c = node('c', 500, 220); const ab = edge('a-b', 'a', 'b'); const ac = edge('a-c', 'a', 'c');
  routeEdges({ elements: [a, b, c, ab, ac] }, { edges: [
    { semanticId: 'a-b', from: 'a', to: 'b', routeHints: { direction: 'right' } },
    { semanticId: 'a-c', from: 'a', to: 'c', routeHints: { direction: 'right' } }
  ] });
  assert.notEqual(ab.y, ac.y);
});

test('keeps a clear primary edge direct when unobstructed', () => {
  const a = node('a', 0, 0); const b = node('b', 400, 0); const e = edge('a-b', 'a', 'b');
  routeEdges({ elements: [a, b, e] }, { layout: { primaryFlow: ['a', 'b'] }, edges: [{ semanticId: 'a-b', from: 'a', to: 'b' }] });
  assert.ok(e.points.length <= 3);
  assert.equal(e.customData.excalidrawSkill.route.priority, 'primary');
});
