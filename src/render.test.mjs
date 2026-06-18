import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';

test('sizes and wraps node labels before layout', () => {
  const scene = renderSpec({ nodes: [{ semanticId: 'events', label: 'Payment Events Topic', shapeRef: 'queue.topic' }], edges: [] });
  const node = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'node');
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'label');
  assert.ok([180, 220, 260].includes(node.width));
  assert.ok(label.text.split('\n').length <= 2);
  assert.equal(label.customData.excalidrawSkill.sourceLabel, 'Payment Events Topic');
  assert.equal(label.originalText, label.text);
});
