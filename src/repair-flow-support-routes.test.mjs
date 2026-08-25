import test from 'node:test';
import assert from 'node:assert/strict';
import { absolutePoints } from './geometry.mjs';
import { repairFlowSupportRoutes } from './repair-flow-support-routes.mjs';

function node(id, x, y, width = 200, height = 80) {
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
    customData: { excalidrawSkill: {
      role: 'edge',
      semanticId: id,
      from,
      to,
      route: { sourceSide: 'down', targetSide: 'right', bends: points.length - 2 }
    } }
  };
}

test('replaces a long downward support detour with a hard-safe lateral entry', () => {
  const validate = node('validate', 100, 100);
  const schema = node('schema', 100, 300, 160, 80);
  const alerts = node('alerts', 380, 300, 180, 80);
  const route = edge('validate-alerts', 'validate', 'alerts', [
    { x: 200, y: 180 },
    { x: 200, y: 220 },
    { x: 600, y: 220 },
    { x: 600, y: 340 },
    { x: 560, y: 340 }
  ]);
  const scene = { type: 'excalidraw', elements: [validate, schema, alerts, route] };
  const spec = {
    version: '2.0',
    diagramType: 'data-flow',
    nodes: [
      { semanticId: 'validate', layoutHints: { rank: 0, importance: 'primary' } },
      { semanticId: 'schema', layoutHints: { rank: 0, importance: 'support' } },
      { semanticId: 'alerts', layoutHints: { rank: 1, importance: 'support' } }
    ],
    edges: [{
      semanticId: 'validate-alerts',
      from: 'validate',
      to: 'alerts',
      routeHints: { direction: 'down', priority: 'secondary' }
    }],
    layout: { profile: 'layered-flow', direction: 'left-to-right', primaryFlow: ['validate'] },
    framePolicy: { mode: 'none' }
  };

  repairFlowSupportRoutes(scene, spec);

  const points = absolutePoints(route);
  assert.ok(points.length <= 4);
  assert.ok(route.customData.excalidrawSkill.route.bends <= 2);
  assert.equal(route.customData.excalidrawSkill.supportRouteRepair.engine, 'flow-support-route-v0.1');
  assert.equal(scene.customData.excalidrawSkill.supportRouteRepair.accepted, 1);
});

test('does not touch primary routes', () => {
  const a = node('a', 0, 0);
  const b = node('b', 300, 300);
  const route = edge('a-b', 'a', 'b', [
    { x: 100, y: 80 },
    { x: 100, y: 120 },
    { x: 500, y: 120 },
    { x: 500, y: 340 },
    { x: 480, y: 340 }
  ]);
  const scene = { elements: [a, b, route] };
  const before = JSON.stringify(route.points);
  repairFlowSupportRoutes(scene, {
    diagramType: 'data-flow',
    nodes: [{ semanticId: 'a' }, { semanticId: 'b' }],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b', routeHints: { direction: 'down', priority: 'primary' } }],
    layout: { profile: 'layered-flow', primaryFlow: ['a', 'b'] }
  });
  assert.equal(JSON.stringify(route.points), before);
});
