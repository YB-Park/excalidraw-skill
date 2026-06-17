import test from 'node:test';
import assert from 'node:assert/strict';
import { placeEdgeLabels } from './place-edge-labels.mjs';
import { boxesOverlap, rectOf } from './geometry.mjs';

function node(id, x, y) { return { id: `node_${id}`, type: 'rectangle', x, y, width: 180, height: 80, customData: { excalidrawSkill: { role: 'node', semanticId: id } } }; }
function edge(id, from, to, x, y, points) { const last = points.at(-1); return { id: `edge_${id}`, type: 'arrow', x, y, width: last[0], height: last[1], points, customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } } }; }
function label(edgeId, x = 0, y = 0) { return { id: `label_${edgeId}`, type: 'text', x, y, width: 112, height: 22, customData: { excalidrawSkill: { role: 'edge-label', edge: edgeId } } }; }

test('honors preferred side on vertical edges', () => {
  const a = node('a', 100, 0); const b = node('b', 100, 300); const e = edge('a-b', 'a', 'b', 190, 80, [[0, 0], [0, 220]]); const l = label('a-b');
  placeEdgeLabels({ elements: [a, b, e, l] }, { edges: [{ semanticId: 'a-b', routeHints: { labelSide: 'right' } }] });
  assert.equal(l.customData.excalidrawSkill.placement.side, 'right');
  assert.ok(l.x > e.x);
});

test('avoids nodes and previously placed labels', () => {
  const a = node('a', 0, 0); const b = node('b', 500, 0); const blocker = node('blocker', 250, -10);
  const e1 = edge('one', 'a', 'b', 180, 40, [[0, 0], [320, 0]]); const e2 = edge('two', 'a', 'b', 180, 60, [[0, 0], [320, 0]]);
  const l1 = label('one'); const l2 = label('two');
  placeEdgeLabels({ elements: [a, b, blocker, e1, e2, l1, l2] }, { edges: [{ semanticId: 'one' }, { semanticId: 'two' }] });
  assert.ok(!boxesOverlap(rectOf(l1), rectOf(blocker)));
  assert.ok(!boxesOverlap(rectOf(l2), rectOf(blocker)));
  assert.ok(!boxesOverlap(rectOf(l1), rectOf(l2)));
});
