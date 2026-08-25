import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { assignFrameMembership } from './assign-frame-membership.mjs';

test('assigns generated nodes and labels to the smallest containing native frame', () => {
  const scene = renderSpec({
    nodes: [{ semanticId: 'service', label: 'Service', shapeRef: 'service.backend' }],
    edges: []
  });
  const node = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'node');
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'label');
  const frame = {
    id: 'frame_internal',
    type: 'frame',
    x: node.x - 40,
    y: node.y - 40,
    width: node.width + 80,
    height: node.height + 80,
    customData: { excalidrawSkill: { semanticId: 'internal', role: 'frame' } }
  };
  scene.elements.unshift(frame);

  assignFrameMembership(scene);

  assert.equal(node.frameId, frame.id);
  assert.equal(label.frameId, frame.id);
});
