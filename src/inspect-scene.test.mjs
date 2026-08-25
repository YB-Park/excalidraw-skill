import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { inspectScene } from './inspect-scene.mjs';

test('inspectScene returns the documented compact summary fields', () => {
  const scene = renderSpec({
    diagramType: 'service-flow',
    title: 'Checkout',
    stylePreset: 'professional-software',
    nodes: [
      { semanticId: 'web', label: 'Web', shapeRef: 'client.web' },
      { semanticId: 'api', label: 'API', shapeRef: 'gateway.api' }
    ],
    edges: [{ semanticId: 'web-api', from: 'web', to: 'api', label: 'HTTPS', kind: 'calls' }]
  });

  const summary = inspectScene(scene, 'checkout.excalidraw');

  assert.equal(summary.sceneTitle, 'checkout.excalidraw');
  assert.equal(summary.diagramType, 'service-flow');
  assert.equal(summary.stylePreset, 'professional-software');
  assert.equal(summary.nodes.length, 2);
  assert.equal(summary.edges.length, 1);
  assert.deepEqual(summary.frames, []);
  assert.deepEqual(summary.warnings, []);
  assert.deepEqual(Object.keys(summary.nodes[0]).sort(), [
    'frameId', 'label', 'manualLayout', 'positionHint', 'semanticId', 'shapeRef'
  ]);
});

test('inspectScene warns about legacy unbound labels and edges', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'a', label: 'A', shapeRef: 'service.backend' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b', kind: 'calls' }]
  });
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'label');
  const edge = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'edge');
  label.containerId = null;
  edge.startBinding = null;

  const summary = inspectScene(scene);
  assert.ok(summary.warnings.some((warning) => warning.code === 'unbound-node-label'));
  assert.ok(summary.warnings.some((warning) => warning.code === 'unbound-edge'));
});
