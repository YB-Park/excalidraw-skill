import test from 'node:test';
import assert from 'node:assert/strict';
import { createFamilyQualityReport } from './family-quality.mjs';

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

const layeredSpec = {
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
    { semanticId: 'app', layer: 'application' },
    { semanticId: 'middleware', layer: 'middleware' },
    { semanticId: 'hardware', layer: 'hardware' }
  ]
};

test('passes a correctly ordered layered system', () => {
  const scene = { elements: [
    node('app', 0, 0),
    node('middleware', 0, 160, { architectureFocus: true }),
    node('hardware', 0, 320)
  ] };
  const report = createFamilyQualityReport(scene, layeredSpec);
  assert.equal(report.supported, true);
  assert.equal(report.pass, true);
});

test('reports inverted architecture layers', () => {
  const scene = { elements: [
    node('app', 0, 220),
    node('middleware', 0, 120, { architectureFocus: true }),
    node('hardware', 0, 20)
  ] };
  const report = createFamilyQualityReport(scene, layeredSpec);
  assert.ok(report.metrics.layerOrderViolations > 0);
  assert.equal(report.pass, false);
});

test('requires focus metadata for layered systems', () => {
  const scene = { elements: [
    node('app', 0, 0),
    node('middleware', 0, 160),
    node('hardware', 0, 320)
  ] };
  const report = createFamilyQualityReport(scene, layeredSpec);
  assert.equal(report.metrics.focusNotMarked, 1);
  assert.equal(report.pass, false);
});

test('checks primary flow ordering for event-flow', () => {
  const spec = {
    version: '2.0',
    diagramType: 'event-flow',
    layout: { profile: 'layered-flow', primaryFlow: ['producer', 'topic', 'consumer'] },
    nodes: [
      { semanticId: 'producer' },
      { semanticId: 'topic' },
      { semanticId: 'consumer' }
    ]
  };
  const good = createFamilyQualityReport({ elements: [
    node('producer', 0, 0), node('topic', 200, 0), node('consumer', 400, 0)
  ] }, spec);
  assert.equal(good.pass, true);

  const bad = createFamilyQualityReport({ elements: [
    node('producer', 400, 0), node('topic', 200, 0), node('consumer', 0, 0)
  ] }, spec);
  assert.equal(bad.metrics.primaryFlowOrderViolations, 2);
  assert.equal(bad.pass, false);
});

const swimlaneSpec = {
  version: '2.0',
  diagramType: 'service-flow',
  layout: {
    profile: 'swimlane-flow',
    direction: 'left-to-right',
    centerAxisY: 280,
    primaryFlow: ['start', 'finish'],
    lanes: [{ id: 'primary', position: 'center' }]
  },
  nodes: [
    { semanticId: 'start', layoutHints: { lane: 'primary', rank: 0 } },
    { semanticId: 'finish', layoutHints: { lane: 'primary', rank: 1 } }
  ]
};

test('requires explicit LayoutState provenance to waive swimlane center-axis violations', () => {
  for (const [extra, expectedViolations] of [
    [{}, 2],
    [{ manualLayout: true }, 2],
    [{ manualLayoutSource: 'layout-state' }, 2],
    [{ manualLayout: true, manualLayoutSource: 'layout-state' }, 0]
  ]) {
    const report = createFamilyQualityReport({ elements: [
      node('start', 0, 0, extra),
      node('finish', 200, 0, extra)
    ] }, swimlaneSpec);
    assert.equal(report.metrics.centerAxisViolations, expectedViolations);
    assert.equal(report.metrics.primaryFlowOrderViolations, 0);
    assert.equal(report.pass, expectedViolations === 0);
  }
});

test('retains primary-flow ordering checks for LayoutState placed swimlane nodes', () => {
  const manualLayout = { manualLayout: true, manualLayoutSource: 'layout-state' };
  const report = createFamilyQualityReport({ elements: [
    node('start', 200, 0, manualLayout),
    node('finish', 0, 0, manualLayout)
  ] }, swimlaneSpec);
  assert.equal(report.metrics.centerAxisViolations, 0);
  assert.equal(report.metrics.primaryFlowOrderViolations, 1);
  assert.equal(report.pass, false);
});

test('marks unimplemented profiles as unsupported', () => {
  const report = createFamilyQualityReport({ elements: [] }, {
    diagramType: 'system-architecture',
    layout: { profile: 'context-view' },
    nodes: []
  });
  assert.equal(report.supported, false);
  assert.equal(report.pass, false);
});

test('rejects singleton frames', () => {
  const frame = {
    id: 'frame_one',
    type: 'frame',
    customData: { excalidrawSkill: { role: 'frame', semanticId: 'one', memberCount: 1 } }
  };
  const spec = {
    version: '2.0',
    diagramType: 'service-flow',
    layout: { profile: 'layered-flow', primaryFlow: ['a'] },
    nodes: [{ semanticId: 'a' }]
  };
  const report = createFamilyQualityReport({ elements: [node('a', 0, 0), frame] }, spec);
  assert.equal(report.metrics.singletonFrames, 1);
  assert.equal(report.pass, false);
});
