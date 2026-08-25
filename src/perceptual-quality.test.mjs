import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerceptualQuality } from './perceptual-quality.mjs';

function node(id, x, y, width = 180, height = 80) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    customData: { excalidrawSkill: { role: 'node', semanticId: id } }
  };
}

function edge(id, from, to, points) {
  const first = points[0];
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: first.x,
    y: first.y,
    width: points.at(-1).x - first.x,
    height: points.at(-1).y - first.y,
    points: points.map((point) => [point.x - first.x, point.y - first.y]),
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } }
  };
}

test('reports low detour and bend cost for a direct primary flow', () => {
  const a = node('a', 0, 0);
  const b = node('b', 360, 0);
  const ab = edge('a-b', 'a', 'b', [
    { x: 180, y: 40 },
    { x: 360, y: 40 }
  ]);
  const report = createPerceptualQuality(
    { elements: [a, b, ab] },
    { layout: { primaryFlow: ['a', 'b'] }, edges: [] }
  );
  assert.equal(report.metrics.totalBends, 0);
  assert.equal(report.metrics.primaryFlowBends, 0);
  assert.equal(report.metrics.averageDetourRatio, 1);
  assert.equal(report.metrics.severeDetours, 0);
});

test('flags a long multi-bend primary route as perceptual risk', () => {
  const a = node('a', 0, 0);
  const b = node('b', 360, 0);
  const ab = edge('a-b', 'a', 'b', [
    { x: 180, y: 40 },
    { x: 180, y: 220 },
    { x: 700, y: 220 },
    { x: 700, y: 40 },
    { x: 360, y: 40 }
  ]);
  const report = createPerceptualQuality(
    { elements: [a, b, ab] },
    { layout: { primaryFlow: ['a', 'b'] }, edges: [] }
  );
  assert.equal(report.metrics.totalBends, 3);
  assert.equal(report.metrics.primaryFlowBends, 3);
  assert.equal(report.metrics.severeDetours, 1);
  assert.ok(report.metrics.readabilityCost > 20);
  assert.ok(report.details.warnings.some((warning) => warning.kind === 'severe-edge-detour'));
  assert.ok(report.details.warnings.some((warning) => warning.kind === 'primary-flow-continuity'));
});

test('reports composition balance without turning it into a hard pass/fail gate', () => {
  const nodes = [
    node('a', 0, 0),
    node('b', 260, 0),
    node('c', 520, 0),
    node('d', 780, 0),
    node('e', 1040, 500)
  ];
  const report = createPerceptualQuality({ elements: nodes }, null);
  assert.equal(report.mode, 'advisory');
  assert.ok(report.metrics.compositionBalanceOffset >= 0);
  assert.ok(report.metrics.compositionDensity > 0);
});
