import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutModuleArchitecture } from './layout-module-architecture.mjs';

function nodeElement(id, index) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x: 100 + index * 220,
    y: 100,
    width: 180,
    height: 80,
    customData: { excalidrawSkill: { role: 'node', semanticId: id } }
  };
}

function labelElement(id, index) {
  return {
    id: `label_${id}`,
    type: 'text',
    x: 116 + index * 220,
    y: 126,
    width: 148,
    height: 28,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

function sceneFor(ids) {
  return { type: 'excalidraw', elements: ids.flatMap((id, index) => [nodeElement(id, index), labelElement(id, index)]) };
}

function positions(scene) {
  return new Map(scene.elements
    .filter((element) => element.customData?.excalidrawSkill?.role === 'node')
    .map((element) => [element.customData.excalidrawSkill.semanticId, { x: element.x, y: element.y }]));
}

test('places internal components in a compact module grid when there is no dominant hub', () => {
  const ids = ['controller', 'registry', 'worker', 'adapter'];
  const spec = {
    diagramType: 'module-architecture',
    layout: { profile: 'component-view' },
    module: { focusModule: 'connection-manager' },
    nodes: ids.map((semanticId) => ({ semanticId, group: 'connection-manager' }))
  };
  const scene = layoutModuleArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  assert.equal(new Set([...p.values()].map((value) => value.x)).size, 2);
  assert.equal(new Set([...p.values()].map((value) => value.y)).size, 2);
  assert.equal(scene.customData.excalidrawSkill.layout.strategy, 'compact-grid');
  assert.deepEqual(scene.customData.excalidrawSkill.layout.internalIds, ids);
});

test('uses a two-column hub grid for a controller-dominated component view', () => {
  const internal = ['controller', 'registry', 'retry', 'adapter', 'events', 'metrics'];
  const ids = [...internal, 'provider'];
  const spec = {
    diagramType: 'module-architecture',
    layout: { profile: 'component-view' },
    module: { focusModule: 'connection-manager' },
    nodes: [
      ...internal.map((semanticId) => ({ semanticId, group: 'connection-manager' })),
      { semanticId: 'provider', shapeRef: 'external.system', layoutHints: { lane: 'right' } }
    ],
    edges: [
      ...internal.slice(1).map((semanticId) => ({ from: 'controller', to: semanticId })),
      { from: 'adapter', to: 'provider' }
    ]
  };
  const scene = layoutModuleArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  const internalPositions = internal.map((id) => p.get(id));
  const xValues = [...new Set(internalPositions.map((value) => value.x))].sort((a, b) => a - b);
  const yValues = [...new Set(internalPositions.map((value) => value.y))].sort((a, b) => a - b);

  assert.equal(scene.customData.excalidrawSkill.layout.strategy, 'hub-grid');
  assert.equal(scene.customData.excalidrawSkill.layout.hubId, 'controller');
  assert.equal(xValues.length, 2);
  assert.equal(yValues.length, 3);
  assert.equal(p.get('controller').x, xValues[0]);
  assert.equal(p.get('controller').y, yValues[1]);
  assert.equal(p.get('adapter').x, xValues[1]);
  assert.equal(p.get('adapter').y, p.get('controller').y);
  assert.equal(p.get('provider').y, p.get('adapter').y);
});

test('keeps external collaborators outside the module boundary', () => {
  const ids = ['controller', 'caller', 'transport'];
  const spec = {
    diagramType: 'module-architecture',
    layout: { profile: 'component-view' },
    module: { focusModule: 'connection-manager' },
    nodes: [
      { semanticId: 'controller', group: 'connection-manager' },
      { semanticId: 'caller', shapeRef: 'client.app' },
      { semanticId: 'transport', shapeRef: 'external.system', layoutHints: { lane: 'right' } }
    ]
  };
  const scene = layoutModuleArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  const boundary = scene.customData.excalidrawSkill.layout.boundary;
  assert.ok(p.get('caller').x < boundary.x);
  assert.ok(p.get('transport').x > boundary.x + boundary.width);
});

test('marks module scope metadata', () => {
  const spec = {
    diagramType: 'module-architecture',
    module: { focusModule: 'module-a' },
    nodes: [
      { semanticId: 'inside', group: 'module-a' },
      { semanticId: 'outside', shapeRef: 'external.system' }
    ]
  };
  const scene = layoutModuleArchitecture(sceneFor(['inside', 'outside']), spec);
  const inside = scene.elements.find((element) => element.customData?.excalidrawSkill?.semanticId === 'inside');
  const outside = scene.elements.find((element) => element.customData?.excalidrawSkill?.semanticId === 'outside');
  assert.equal(inside.customData.excalidrawSkill.moduleScope, 'internal');
  assert.equal(outside.customData.excalidrawSkill.moduleScope, 'external');
});

test('is a no-op for other families', () => {
  const scene = sceneFor(['a']);
  const before = JSON.stringify(scene);
  layoutModuleArchitecture(scene, { diagramType: 'system-architecture', nodes: [] });
  assert.equal(JSON.stringify(scene), before);
});
