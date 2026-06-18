import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualityReport } from './quality-report.mjs';

function node(id, x, y, extra = {}) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x,
    y,
    width: 100,
    height: 60,
    customData: { excalidrawSkill: { role: 'node', semanticId: id, ...extra } }
  };
}

function edge(id, from, to, x, y, points) {
  const last = points.at(-1);
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x,
    y,
    width: last[0],
    height: last[1],
    points,
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } }
  };
}

function edgeLabel(id, x, y) {
  return {
    id: `label_${id}`,
    type: 'text',
    x,
    y,
    width: 80,
    height: 20,
    customData: { excalidrawSkill: { role: 'edge-label', edge: id } }
  };
}

function nodeLabel(id, text, x, y, width = 80, height = 24) {
  return {
    id: `node_label_${id}`,
    type: 'text',
    text,
    x,
    y,
    width,
    height,
    fontSize: 18,
    lineHeight: 1.25,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

test('passes a clean compact flow scene', () => {
  const a = node('a', 0, 0);
  const b = node('b', 300, 0);
  const e = edge('a-b', 'a', 'b', 100, 30, [[0, 0], [200, 0]]);
  const l = edgeLabel('a-b', 160, 0);
  const report = createQualityReport(
    { elements: [a, b, e, l] },
    {
      diagramType: 'service-flow',
      layout: { profile: 'layered-flow', primaryFlow: ['a', 'b'] },
      nodes: [{ semanticId: 'a' }, { semanticId: 'b' }]
    }
  );
  assert.equal(report.structuralPass, true);
  assert.equal(report.familyPass, true);
  assert.equal(report.pass, true);
});

test('reports text overflow', () => {
  const a = node('a', 0, 0);
  const label = nodeLabel('a', 'Payment Events Topic', 10, 10, 80, 24);
  const report = createQualityReport({ elements: [a, label] });
  assert.equal(report.metrics.textOverflows, 1);
  assert.ok(report.suggestedPatches.some((patch) => patch.operation === 'wrap-or-resize-node-label'));
});

test('reports overlapping endpoint segments', () => {
  const a = node('a', 0, 0);
  const b = node('b', 300, -80);
  const c = node('c', 300, 80);
  const first = edge('a-b', 'a', 'b', 100, 30, [[0, 0], [40, 0], [200, -80]]);
  const second = edge('a-c', 'a', 'c', 100, 30, [[0, 0], [40, 0], [200, 80]]);
  const report = createQualityReport({ elements: [a, b, c, first, second] });
  assert.equal(report.metrics.endpointOverlaps, 1);
});

test('reports target-boundary following instead of perpendicular entry', () => {
  const a = node('a', 0, 0);
  const b = node('b', 0, 200);
  const e = edge('a-b', 'a', 'b', 50, 60, [[0, 0], [-20, 140], [0, 140]]);
  const report = createQualityReport({ elements: [a, b, e] });
  assert.ok(report.metrics.endpointApproachViolations > 0);
});

test('fails family quality when layered-system order is inverted', () => {
  const scene = {
    elements: [
      node('application', 0, 300),
      node('middleware', 0, 160, { architectureFocus: true }),
      node('hardware', 0, 0)
    ]
  };
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      focus: ['middleware'],
      layers: [
        { id: 'application', order: 0 },
        { id: 'middleware', order: 1 },
        { id: 'hardware', order: 2 }
      ]
    },
    nodes: [
      { semanticId: 'application', layer: 'application' },
      { semanticId: 'middleware', layer: 'middleware' },
      { semanticId: 'hardware', layer: 'hardware' }
    ]
  };
  const report = createQualityReport(scene, spec);
  assert.equal(report.structuralPass, true);
  assert.equal(report.familyPass, false);
  assert.equal(report.pass, false);
  assert.ok(report.metrics.layerOrderViolations > 0);
});

test('unsupported family profile cannot pass by structural checks alone', () => {
  const report = createQualityReport(
    { elements: [node('gateway', 0, 0)] },
    {
      diagramType: 'system-architecture',
      layout: { profile: 'context-view' },
      nodes: [{ semanticId: 'gateway' }]
    }
  );
  assert.equal(report.structuralPass, true);
  assert.equal(report.familyQuality.supported, false);
  assert.equal(report.familyPass, false);
  assert.equal(report.pass, false);
});
