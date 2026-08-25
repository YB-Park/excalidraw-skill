import test from 'node:test';
import assert from 'node:assert/strict';
import { repairModuleRoutes } from './repair-module-routes.mjs';
import { absolutePoints } from './geometry.mjs';

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

const spec = {
  diagramType: 'module-architecture',
  layout: { profile: 'component-view' },
  module: { focusModule: 'manager' },
  nodes: [
    { semanticId: 'controller', group: 'manager' },
    { semanticId: 'registry', group: 'manager' },
    { semanticId: 'scheduler', group: 'manager' },
    { semanticId: 'adapter', group: 'manager' },
    { semanticId: 'events', group: 'manager' },
    { semanticId: 'external', shapeRef: 'external.system' }
  ]
};

test('reroutes an internal edge that escapes above the predicted module boundary', () => {
  const controller = node('controller', 100, 100);
  const registry = node('registry', 360, 100);
  const scheduler = node('scheduler', 620, 100);
  const routed = edge('controller-scheduler', 'controller', 'scheduler', [
    { x: 280, y: 140 },
    { x: 300, y: 140 },
    { x: 300, y: 20 },
    { x: 710, y: 20 },
    { x: 710, y: 100 }
  ], { sourceSide: 'right', targetSide: 'up', axisLock: null });
  const scene = { elements: [controller, registry, scheduler, routed] };

  repairModuleRoutes(scene, spec);

  const points = absolutePoints(routed);
  assert.ok(points.every((point) => point.y >= 60));
  assert.equal(scene.customData.excalidrawSkill.moduleRouteRepair.repaired, 1);
});

test('uses a distinct distributed hub port to reduce a diagonal hub spoke from three bends to two', () => {
  const controller = node('controller', 100, 200);
  const adapter = node('adapter', 380, 200);
  const events = node('events', 380, 20);
  const direct = edge('controller-adapter', 'controller', 'adapter', [
    { x: 280, y: 240 },
    { x: 380, y: 240 }
  ], { sourceSide: 'right', targetSide: 'left', axisLock: 'horizontal' });
  const routed = edge('controller-events', 'controller', 'events', [
    { x: 280, y: 240 },
    { x: 300, y: 240 },
    { x: 300, y: 60 },
    { x: 470, y: 60 },
    { x: 470, y: 20 }
  ], { sourceSide: 'right', targetSide: 'up', axisLock: null });
  const scene = {
    customData: { excalidrawSkill: { layout: { strategy: 'hub-grid', hubId: 'controller' } } },
    elements: [controller, adapter, events, direct, routed]
  };

  repairModuleRoutes(scene, spec);

  const points = absolutePoints(routed);
  assert.equal(points.length, 4);
  assert.notEqual(points[0].y, 240);
  assert.equal(routed.customData.excalidrawSkill.route.sourceSide, 'right');
  assert.equal(routed.customData.excalidrawSkill.route.targetSide, 'left');
  assert.equal(scene.customData.excalidrawSkill.moduleRouteRepair.hubSpokesRepaired, 1);
  assert.equal(routed.customData.excalidrawSkill.moduleHubSpoke.hubPortFraction, 0.25);
});

test('leaves external-crossing edges outside the containment rule', () => {
  const controller = node('controller', 100, 100);
  const external = node('external', 900, 100);
  const routed = edge('controller-external', 'controller', 'external', [
    { x: 280, y: 140 },
    { x: 900, y: 140 }
  ], { sourceSide: 'right', targetSide: 'left', axisLock: 'horizontal' });
  const before = JSON.stringify(routed.points);

  repairModuleRoutes({ elements: [controller, external, routed] }, spec);

  assert.equal(JSON.stringify(routed.points), before);
});
