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

test('renders semantic data-plane critical edge visual intent', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'collector', label: 'Collector', shapeRef: 'service.backend' },
      { semanticId: 'pipeline', label: 'Pipeline', shapeRef: 'service.backend' }
    ],
    edges: [{
      semanticId: 'collector-pipeline',
      from: 'collector',
      to: 'pipeline',
      kind: 'transfers',
      visual: { role: 'data-plane', emphasis: 'critical', stroke: 'solid' }
    }]
  });
  const edge = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'edge');

  assert.equal(edge.strokeColor, '#dc2626');
  assert.equal(edge.strokeWidth, 4);
  assert.equal(edge.strokeStyle, 'solid');
  assert.deepEqual(edge.customData.excalidrawSkill.visual, {
    role: 'data-plane',
    emphasis: 'critical',
    stroke: 'solid'
  });
});

test('renders dashed event-stream edge visual intent', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'topic', label: 'Topic', shapeRef: 'queue.topic' },
      { semanticId: 'worker', label: 'Worker', shapeRef: 'service.worker' }
    ],
    edges: [{
      semanticId: 'topic-worker',
      from: 'topic',
      to: 'worker',
      kind: 'publishes',
      visual: { role: 'event-stream', stroke: 'dashed' }
    }]
  });
  const edge = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'edge');

  assert.equal(edge.strokeColor, '#0891b2');
  assert.equal(edge.strokeWidth, 2);
  assert.equal(edge.strokeStyle, 'dashed');
  assert.deepEqual(edge.customData.excalidrawSkill.visual, {
    role: 'event-stream',
    emphasis: 'normal',
    stroke: 'dashed'
  });
});
