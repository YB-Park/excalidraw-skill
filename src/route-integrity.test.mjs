import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteIntegrityReport } from './route-integrity.mjs';

function node(id, x, y) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x,
    y,
    width: 180,
    height: 80,
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

test('passes an edge that reaches the facing target boundary without entering the node', () => {
  const source = node('source', 0, 0);
  const target = node('target', 420, 180);
  const routed = edge('source-target', 'source', 'target', [
    { x: 180, y: 40 },
    { x: 300, y: 40 },
    { x: 300, y: 220 },
    { x: 420, y: 220 }
  ]);
  const report = createRouteIntegrityReport({ elements: [source, target, routed] });
  assert.equal(report.pass, true);
  assert.equal(report.metrics.endpointNodePenetrations, 0);
});

test('detects a penultimate segment that crosses the target interior before ending on another side', () => {
  const source = node('source', 0, 0);
  const target = node('target', 420, 180);
  const routed = edge('source-target', 'source', 'target', [
    { x: 180, y: 40 },
    { x: 600, y: 40 },
    { x: 600, y: 220 },
    { x: 420, y: 220 },
    { x: 600, y: 220 },
    { x: 600, y: 180 }
  ]);
  const report = createRouteIntegrityReport({ elements: [source, target, routed] });
  assert.equal(report.pass, false);
  assert.equal(report.metrics.endpointNodePenetrations, 1);
  assert.equal(report.details.endpointNodePenetrations[0].endpoint, 'target');
  assert.ok(report.details.endpointNodePenetrations[0].penetratingSegments.length >= 1);
});
