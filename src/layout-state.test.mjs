import test from 'node:test';
import assert from 'node:assert/strict';
import { captureLayoutState, applyLayoutState } from './layout-state.mjs';

function fixtureScene() {
  return {
    elements: [
      {
        id: 'node-1', type: 'rectangle', x: 100, y: 200, width: 120, height: 60,
        boundElements: [{ id: 'label-1', type: 'text' }, { id: 'edge-1', type: 'arrow' }],
        customData: { excalidrawSkill: { role: 'node', semanticId: 'payment-service' } }
      },
      { id: 'label-1', type: 'text', x: 120, y: 220, width: 80, height: 20, containerId: 'node-1' },
      {
        id: 'node-2', type: 'rectangle', x: 400, y: 200, width: 120, height: 60,
        boundElements: [{ id: 'edge-1', type: 'arrow' }],
        customData: { excalidrawSkill: { role: 'node', semanticId: 'worker' } }
      },
      {
        id: 'edge-1', type: 'arrow', x: 220, y: 230, width: 180, height: 0,
        points: [[0, 0], [180, 0]],
        startBinding: { elementId: 'node-1', focus: 0, gap: 0 },
        endBinding: { elementId: 'node-2', focus: 0, gap: 0 },
        customData: { excalidrawSkill: { role: 'edge', semanticId: 'payment-to-worker', from: 'payment-service', to: 'worker', route: { sourceSide: 'right', targetSide: 'left' } } }
      },
      {
        id: 'edge-label-1', type: 'text', x: 275, y: 190, width: 70, height: 20,
        customData: { excalidrawSkill: { role: 'edge-label', edge: 'payment-to-worker' } }
      }
    ]
  };
}

function absolutePoints(edge) {
  return edge.points.map(([x, y]) => [edge.x + x, edge.y + y]);
}

test('captureLayoutState records semantic node positions only', () => {
  const state = captureLayoutState(fixtureScene());
  assert.deepEqual(Object.keys(state.nodes).sort(), ['payment-service', 'worker']);
  assert.deepEqual(state.nodes['payment-service'], { x: 100, y: 200, width: 120, height: 60, locked: true });
});

test('applyLayoutState moves a semantic node and its bound label while preserving unrelated nodes', () => {
  const scene = fixtureScene();
  const state = captureLayoutState(scene);
  state.nodes['payment-service'].x = 180;
  state.nodes['payment-service'].y = 260;
  const result = applyLayoutState(scene, state);
  const node = result.scene.elements.find((element) => element.id === 'node-1');
  const label = result.scene.elements.find((element) => element.id === 'label-1');
  const worker = result.scene.elements.find((element) => element.id === 'node-2');
  assert.deepEqual([node.x, node.y], [180, 260]);
  assert.deepEqual([label.x, label.y], [200, 280]);
  assert.deepEqual([worker.x, worker.y], [400, 200]);
  assert.equal(node.customData.excalidrawSkill.manualLayout, true);
  assert.equal(node.customData.excalidrawSkill.manualLayoutSource, 'layout-state');
  assert.deepEqual(result.moves, [{ semanticId: 'payment-service', dx: 80, dy: 60 }]);
  assert.equal(result.requiresFreshReview, true);
});

test('applyLayoutState reroutes connected edge endpoints to moved node boundaries', () => {
  const scene = fixtureScene();
  const state = captureLayoutState(scene);
  state.nodes['payment-service'].x = 180;
  state.nodes['payment-service'].y = 260;
  const result = applyLayoutState(scene, state);
  const edge = result.scene.elements.find((element) => element.id === 'edge-1');
  const points = absolutePoints(edge);
  assert.deepEqual(points[0], [300, 290]);
  assert.deepEqual(points.at(-1), [400, 230]);
  assert.ok(points.length >= 4, 'reconciled route should retain orthogonal endpoint stubs');
  assert.equal(points[0][1], points[1][1], 'source endpoint should leave horizontally');
  assert.equal(points.at(-1)[1], points.at(-2)[1], 'target endpoint should approach horizontally');
  assert.equal(edge.customData.excalidrawSkill.layoutStateReconciled, true);
  assert.deepEqual(result.reconciledEdges.map((item) => item.semanticId), ['payment-to-worker']);
  assert.equal(result.scene.customData.excalidrawSkill.layoutStateReconciliation.reconciledEdges, 1);
});

test('applyLayoutState keeps edge labels associated with reconciled geometry', () => {
  const scene = fixtureScene();
  const state = captureLayoutState(scene);
  state.nodes['payment-service'].x = 180;
  state.nodes['payment-service'].y = 260;
  const result = applyLayoutState(scene, state);
  const label = result.scene.elements.find((element) => element.id === 'edge-label-1');
  assert.deepEqual([label.x, label.y], [315, 220]);
});

test('unlocked layout state is advisory and does not move the node or reroute edges', () => {
  const scene = fixtureScene();
  const state = captureLayoutState(scene);
  state.nodes.worker = { ...state.nodes.worker, x: 900, locked: false };
  const result = applyLayoutState(scene, state);
  const worker = result.scene.elements.find((element) => element.id === 'node-2');
  const edge = result.scene.elements.find((element) => element.id === 'edge-1');
  assert.equal(worker.x, 400);
  assert.deepEqual(absolutePoints(edge), [[220, 230], [400, 230]]);
  assert.deepEqual(result.reconciledEdges, []);
});
