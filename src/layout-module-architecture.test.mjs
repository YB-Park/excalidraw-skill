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

test('places internal components in a compact module grid', () => {
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
  assert.deepEqual(scene.customData.excalidrawSkill.layout.internalIds, ids);
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
