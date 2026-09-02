import test from 'node:test';
import assert from 'node:assert/strict';
import { captureLayoutState, applyLayoutState } from './layout-state.mjs';

function fixtureScene() {
  return {
    elements: [
      {
        id: 'node-1', type: 'rectangle', x: 100, y: 200, width: 120, height: 60,
        boundElements: [{ id: 'label-1', type: 'text' }],
        customData: { excalidrawSkill: { role: 'node', semanticId: 'payment-service' } }
      },
      { id: 'label-1', type: 'text', x: 120, y: 220, width: 80, height: 20, containerId: 'node-1' },
      {
        id: 'node-2', type: 'rectangle', x: 400, y: 200, width: 120, height: 60,
        customData: { excalidrawSkill: { role: 'node', semanticId: 'worker' } }
      }
    ]
  };
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
  assert.deepEqual(result.moves, [{ semanticId: 'payment-service', dx: 80, dy: 60 }]);
});

test('unlocked layout state is advisory and does not move the node', () => {
  const scene = fixtureScene();
  const state = captureLayoutState(scene);
  state.nodes.worker = { ...state.nodes.worker, x: 900, locked: false };
  const result = applyLayoutState(scene, state);
  const worker = result.scene.elements.find((element) => element.id === 'node-2');
  assert.equal(worker.x, 400);
});
