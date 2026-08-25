import test from 'node:test';
import assert from 'node:assert/strict';
import { repairEndpointRoutes } from './repair-endpoint-routes.mjs';
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

function edge(id, from, to, points, route = {}) {
  const first = points[0];
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: first.x,
    y: first.y,
    width: points.at(-1).x - first.x,
    height: points.at(-1).y - first.y,
    points: points.map((point) => [point.x - first.x, point.y - first.y]),
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, route } }
  };
}

test('repairs a fan-out edge that crosses its target before ending on the far boundary', () => {
  const router = node('router', 300, 0);
  const policy = node('policy', 600, 120);
  const quota = node('quota', 600, 280);
  const risk = node('risk', 600, 440);
  const bad = edge('router-risk', 'router', 'risk', [
    { x: 390, y: 80 },
    { x: 390, y: 480 },
    { x: 780, y: 480 },
    { x: 780, y: 440 }
  ], { sourceSide: 'down', targetSide: 'right' });
  const scene = { elements: [router, policy, quota, risk, bad] };

  assert.equal(createRouteIntegrityReport(scene).pass, false);
  repairEndpointRoutes(scene);
  const report = createRouteIntegrityReport(scene);

  assert.equal(report.pass, true);
  assert.equal(report.metrics.endpointNodePenetrations, 0);
  assert.ok(bad.customData.excalidrawSkill.endpointIntegrityRepair);
  assert.notEqual(bad.customData.excalidrawSkill.route.targetSide, 'right');
});

test('is a no-op for already valid routes', () => {
  const source = node('source', 0, 0);
  const target = node('target', 360, 0);
  const valid = edge('source-target', 'source', 'target', [
    { x: 180, y: 40 },
    { x: 360, y: 40 }
  ], { sourceSide: 'right', targetSide: 'left' });
  const before = JSON.stringify(valid.points);
  const scene = { elements: [source, target, valid] };

  repairEndpointRoutes(scene);

  assert.equal(JSON.stringify(valid.points), before);
  assert.equal(createRouteIntegrityReport(scene).pass, true);
});
