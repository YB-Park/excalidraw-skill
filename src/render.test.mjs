import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { baseElementStyle } from './style-preset.mjs';

test('sizes and wraps node labels before layout', () => {
  const scene = renderSpec({ nodes: [{ semanticId: 'events', label: 'Payment Events Topic', shapeRef: 'queue.topic' }], edges: [] });
  const node = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'node');
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'label');
  assert.ok([180, 220, 260].includes(node.width));
  assert.ok(label.text.split('\n').length <= 2);
  assert.equal(label.customData.excalidrawSkill.sourceLabel, 'Payment Events Topic');
  assert.equal(label.originalText, label.text);
});

test('uses runtime preset base tokens for generated elements', () => {
  const scene = renderSpec({
    stylePreset: 'professional-software',
    nodes: [{ semanticId: 'api', label: 'API', shapeRef: 'gateway.api' }],
    edges: []
  });
  const node = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'node');
  const base = baseElementStyle('professional-software');
  assert.equal(node.strokeColor, base.strokeColor);
  assert.equal(node.backgroundColor, base.backgroundColor);
  assert.equal(node.strokeWidth, base.strokeWidth);
  assert.equal(node.strokeStyle, base.strokeStyle);
  assert.equal(node.roughness, base.roughness);
  assert.equal(node.opacity, base.opacity);
});

test('rejects an unsupported style preset before rendering', () => {
  assert.throws(() => renderSpec({ stylePreset: 'unknown-style', nodes: [], edges: [] }), /Unsupported style preset/u);
});

test('binds node labels to native Excalidraw containers', () => {
  const scene = renderSpec({ nodes: [{ semanticId: 'api', label: 'API Gateway', shapeRef: 'gateway.api' }], edges: [] });
  const node = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'node');
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'label');

  assert.equal(label.containerId, node.id);
  assert.ok(node.boundElements.some((item) => item.id === label.id && item.type === 'text'));
});

test('binds arrows to source and target nodes', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'source', label: 'Source', shapeRef: 'service.backend' },
      { semanticId: 'target', label: 'Target', shapeRef: 'service.backend' }
    ],
    edges: [{ semanticId: 'source-target', from: 'source', to: 'target', kind: 'calls' }]
  });
  const nodes = new Map(scene.elements
    .filter((element) => element.customData.excalidrawSkill.role === 'node')
    .map((element) => [element.customData.excalidrawSkill.semanticId, element]));
  const edge = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'edge');

  assert.equal(edge.startBinding.elementId, nodes.get('source').id);
  assert.equal(edge.endBinding.elementId, nodes.get('target').id);
  assert.ok(nodes.get('source').boundElements.some((item) => item.id === edge.id && item.type === 'arrow'));
  assert.ok(nodes.get('target').boundElements.some((item) => item.id === edge.id && item.type === 'arrow'));
});

test('stores inspectable scene metadata', () => {
  const scene = renderSpec({
    diagramType: 'service-flow',
    title: 'Checkout',
    stylePreset: 'professional-software',
    nodes: [{ semanticId: 'api', label: 'API', shapeRef: 'gateway.api' }],
    edges: []
  });

  assert.deepEqual(scene.customData.excalidrawSkill, {
    diagramType: 'service-flow',
    title: 'Checkout',
    stylePreset: 'professional-software'
  });
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
