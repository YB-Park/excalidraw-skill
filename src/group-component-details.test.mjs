import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { groupComponentDetails } from './group-component-details.mjs';

test('groups generated component details with the nearest semantic node', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'a', label: 'A', shapeRef: 'service.backend' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
    ],
    edges: []
  });
  const a = scene.elements.find((element) => element.customData.excalidrawSkill.semanticId === 'a');
  const detail = {
    id: 'detail_a',
    type: 'rectangle',
    x: a.x + 5,
    y: a.y + 5,
    width: 10,
    height: 10,
    groupIds: [],
    customData: { excalidrawSkill: { role: 'component-detail' } }
  };
  scene.elements.unshift(detail);

  groupComponentDetails(scene);

  const groupId = a.groupIds[0];
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.node === 'a');
  assert.ok(groupId);
  assert.ok(detail.groupIds.includes(groupId));
  assert.ok(label.groupIds.includes(groupId));
  assert.equal(detail.customData.excalidrawSkill.parentNode, 'a');
});
