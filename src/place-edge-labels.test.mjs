import test from 'node:test';
import assert from 'node:assert/strict';
import { placeEdgeLabels } from './place-edge-labels.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';
import { boxesOverlap, rectOf } from './geometry.mjs';

function node(id, x, y) { return { id: `node_${id}`, type: 'rectangle', x, y, width: 180, height: 80, frameId: null, customData: { excalidrawSkill: { role: 'node', semanticId: id } } }; }
function edge(id, from, to, x, y, points) { const last = points.at(-1); return { id: `edge_${id}`, type: 'arrow', x, y, width: last[0], height: last[1], points, customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } } }; }
function label(edgeId, x = 0, y = 0) { return { id: `label_${edgeId}`, type: 'text', x, y, width: 112, height: 22, customData: { excalidrawSkill: { role: 'edge-label', edge: edgeId } } }; }
function frame(id, x, y, width, height) { return { id: `frame_${id}`, type: 'frame', name: id, x, y, width, height, customData: { excalidrawSkill: { role: 'frame', semanticId: id } } }; }

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

test('uses the clear source-target corridor for a short-gap label', () => {
  const a = node('a', 0, 0);
  const b = node('b', 300, 0);
  const e = edge('a-b', 'a', 'b', 180, 40, [[0, 0], [120, 0]]);
  const l = label('a-b');

  placeEdgeLabels({ elements: [a, b, e, l] }, { edges: [{ semanticId: 'a-b' }] });

  assert.ok(!boxesOverlap(rectOf(l), rectOf(a)));
  assert.ok(!boxesOverlap(rectOf(l), rectOf(b)));
  assert.ok(l.customData.excalidrawSkill.placement.ownDistance <= 30);
  assert.equal(l.customData.excalidrawSkill.placement.endpointCorridorRelaxed, true);
});

test('keeps parallel-edge labels associated with their own edge', () => {
  const e1 = edge('top', 'a', 'b', 0, 100, [[0, 0], [400, 0]]);
  const e2 = edge('bottom', 'c', 'd', 0, 160, [[0, 0], [400, 0]]);
  const l1 = label('top');
  const l2 = label('bottom');
  const scene = { elements: [e1, e2, l1, l2] };

  placeEdgeLabels(scene, { edges: [{ semanticId: 'top' }, { semanticId: 'bottom' }] });
  const quality = createPerceptualQuality(scene);

  assert.equal(quality.metrics.ambiguousEdgeLabels, 0);
  assert.ok(l1.customData.excalidrawSkill.placement.ownDistance <= l1.customData.excalidrawSkill.placement.nearestOtherDistance);
  assert.ok(l2.customData.excalidrawSkill.placement.ownDistance <= l2.customData.excalidrawSkill.placement.nearestOtherDistance);
});

test('uses a quarter-position when a sibling trunk blocks the midpoint corridor', () => {
  const hub = node('hub', 0, 100);
  const target = node('target', 400, 100);
  const main = edge('main', 'hub', 'target', 180, 140, [[0, 0], [220, 0]]);
  const spoke = edge('spoke', 'hub', 'satellite', 180, 116, [[0, 0], [110, 0], [110, -96], [220, -96]]);
  const relation = label('main');
  relation.width = 82;
  relation.height = 38;
  const scene = { elements: [hub, target, main, spoke, relation] };

  placeEdgeLabels(scene, { edges: [{ semanticId: 'main' }, { semanticId: 'spoke' }] });
  const quality = createPerceptualQuality(scene);

  assert.equal(quality.metrics.ambiguousEdgeLabels, 0);
  assert.ok(relation.x + relation.width < 290 || relation.x > 290);
  assert.ok(relation.customData.excalidrawSkill.placement.nearestOtherDistance >= relation.customData.excalidrawSkill.placement.ownDistance);
});

test('keeps a shared-frame edge label inside the native frame even when the nearest outside position avoids the border', () => {
  const boundary = frame('module-a', 100, 80, 600, 300);
  const a = node('a', 170, 210);
  const b = node('b', 500, 110);
  a.frameId = boundary.id;
  b.frameId = boundary.id;
  const e = edge('a-b', 'a', 'b', 350, 250, [
    [0, 0],
    [0, -140],
    [150, -140]
  ]);
  const l = label('a-b');
  const scene = { elements: [boundary, a, b, e, l] };

  placeEdgeLabels(scene, { edges: [{ semanticId: 'a-b' }] });

  assert.ok(l.x >= boundary.x + 10);
  assert.ok(l.x + l.width <= boundary.x + boundary.width - 10);
  assert.ok(l.y >= boundary.y + 10);
  assert.ok(l.y + l.height <= boundary.y + boundary.height - 10);
  assert.equal(l.customData.excalidrawSkill.placement.sharedFrameId, boundary.id);
  assert.equal(l.customData.excalidrawSkill.placement.frameContained, true);
});
