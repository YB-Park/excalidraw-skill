import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyRoutes } from './simplify-routes.mjs';
import { polylineLength, segmentsFromEdge } from './geometry.mjs';

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

function edge(id, from, to, points, route) {
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

test('replaces a long global detour with a shorter collision-free local route', () => {
  const source = node('source', 0, 0);
  const target = node('target', 420, 260);
  const routed = edge('source-target', 'source', 'target', [
    { x: 90, y: 80 },
    { x: 90, y: 100 },
    { x: 800, y: 100 },
    { x: 800, y: 240 },
    { x: 510, y: 240 },
    { x: 510, y: 260 }
  ], { sourceSide: 'down', targetSide: 'up', axisLock: null });
  const before = polylineLength(segmentsFromEdge(routed).map((segment) => segment.a).concat(segmentsFromEdge(routed).at(-1).b));

  simplifyRoutes({ elements: [source, target, routed] });

  const afterPoints = segmentsFromEdge(routed);
  const after = afterPoints.reduce((sum, segment) => sum + Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y), 0);
  assert.ok(after < before);
  assert.ok(routed.customData.excalidrawSkill.routeSimplification);
});

test('keeps a detour when the short local route would hit a blocker', () => {
  const source = node('source', 0, 0);
  const blocker = node('blocker', 210, 120);
  const target = node('target', 420, 260);
  const points = [
    { x: 90, y: 80 },
    { x: 90, y: 100 },
    { x: -80, y: 100 },
    { x: -80, y: 240 },
    { x: 510, y: 240 },
    { x: 510, y: 260 }
  ];
  const routed = edge('source-target', 'source', 'target', points, { sourceSide: 'down', targetSide: 'up', axisLock: null });
  const before = JSON.stringify(routed.points);

  simplifyRoutes({ elements: [source, blocker, target, routed] });

  assert.equal(JSON.stringify(routed.points), before);
});

test('does not change an axis-locked route', () => {
  const source = node('source', 0, 0);
  const target = node('target', 0, 300);
  const routed = edge('source-target', 'source', 'target', [
    { x: 90, y: 80 },
    { x: 90, y: 300 }
  ], { sourceSide: 'down', targetSide: 'up', axisLock: 'vertical' });
  const before = JSON.stringify(routed.points);

  simplifyRoutes({ elements: [source, target, routed] });

  assert.equal(JSON.stringify(routed.points), before);
});
