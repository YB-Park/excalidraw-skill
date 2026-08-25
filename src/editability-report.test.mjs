import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { groupComponentDetails } from './group-component-details.mjs';

test('passes a natively bound generated scene', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'a', label: 'A', shapeRef: 'service.backend' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b', kind: 'calls' }]
  });

  const report = createEditabilityReport(scene);
  assert.equal(report.pass, true);
  assert.equal(report.metrics.unboundLabels, 0);
  assert.equal(report.metrics.invalidEdgeBindings, 0);
});

test('fails when a node label loses its native container binding', () => {
  const scene = renderSpec({
    nodes: [{ semanticId: 'a', label: 'A', shapeRef: 'service.backend' }],
    edges: []
  });
  const label = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'label');
  label.containerId = null;

  const report = createEditabilityReport(scene);
  assert.equal(report.pass, false);
  assert.equal(report.metrics.unboundLabels, 1);
});

test('fails when an arrow loses one endpoint binding', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'a', label: 'A', shapeRef: 'service.backend' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b', kind: 'calls' }]
  });
  const edge = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'edge');
  edge.endBinding = null;

  const report = createEditabilityReport(scene);
  assert.equal(report.pass, false);
  assert.equal(report.metrics.invalidEdgeBindings, 1);
});

test('requires generated component details to share a native group with their parent', () => {
  const scene = renderSpec({
    nodes: [{ semanticId: 'a', label: 'A', shapeRef: 'service.backend' }],
    edges: []
  });
  const node = scene.elements.find((element) => element.customData.excalidrawSkill.role === 'node');
  scene.elements.unshift({
    id: 'detail',
    type: 'rectangle',
    x: node.x + 4,
    y: node.y + 4,
    width: 10,
    height: 10,
    groupIds: [],
    customData: { excalidrawSkill: { role: 'component-detail' } }
  });

  assert.equal(createEditabilityReport(scene).pass, false);
  groupComponentDetails(scene);
  assert.equal(createEditabilityReport(scene).pass, true);
});
