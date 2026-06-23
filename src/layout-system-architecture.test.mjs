import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutSystemArchitecture } from './layout-system-architecture.mjs';

function nodeElement(id, index) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x: 100 + index * 240,
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
    x: 116 + index * 240,
    y: 126,
    width: 148,
    height: 28,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

function sceneFor(ids) {
  return {
    type: 'excalidraw',
    elements: ids.flatMap((id, index) => [nodeElement(id, index), labelElement(id, index)])
  };
}

function positions(scene) {
  return new Map(
    scene.elements
      .filter((element) => element.customData?.excalidrawSkill?.role === 'node')
      .map((element) => [element.customData.excalidrawSkill.semanticId, { x: element.x, y: element.y }])
  );
}

test('preserves declared top-to-bottom layer order', () => {
  const ids = ['app', 'middleware', 'driver', 'hardware'];
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      layers: [
        { id: 'application', order: 0 },
        { id: 'middleware', order: 1 },
        { id: 'driver', order: 2 },
        { id: 'hardware', order: 3 }
      ]
    },
    nodes: [
      { semanticId: 'app', layer: 'application' },
      { semanticId: 'middleware', layer: 'middleware' },
      { semanticId: 'driver', layer: 'driver' },
      { semanticId: 'hardware', layer: 'hardware' }
    ]
  };

  const scene = layoutSystemArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  assert.ok(p.get('app').y < p.get('middleware').y);
  assert.ok(p.get('middleware').y < p.get('driver').y);
  assert.ok(p.get('driver').y < p.get('hardware').y);
  assert.equal(scene.customData.excalidrawSkill.layout.profile, 'layered-system');
});

test('marks the focus module without affecting family semantics', () => {
  const ids = ['service-a', 'focus', 'service-b'];
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      focus: ['focus'],
      layers: [{ id: 'middleware', order: 0 }]
    },
    nodes: ids.map((semanticId) => ({ semanticId, layer: 'middleware' }))
  };

  const scene = layoutSystemArchitecture(sceneFor(ids), spec);
  const focus = scene.elements.find((element) => element.customData?.excalidrawSkill?.semanticId === 'focus');
  assert.equal(focus.customData.excalidrawSkill.architectureFocus, true);
  assert.equal(scene.customData.excalidrawSkill.layout.placedNodes, 3);
});

test('places layerless external systems in a side column', () => {
  const ids = ['middleware', 'cloud'];
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: { layers: [{ id: 'middleware', order: 0 }] },
    nodes: [
      { semanticId: 'middleware', layer: 'middleware', shapeRef: 'service.backend' },
      { semanticId: 'cloud', shapeRef: 'external.system' }
    ]
  };
  const scene = layoutSystemArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  assert.ok(p.get('cloud').x > p.get('middleware').x);
  assert.deepEqual(scene.customData.excalidrawSkill.layout.externalIds, ['cloud']);
});

test('reserves frame-aware vertical gap for adjacent distinct explicit singleton frames', () => {
  const ids = ['upper', 'lower'];
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      layers: [
        { id: 'upper-layer', order: 0 },
        { id: 'lower-layer', order: 1 }
      ]
    },
    groups: [
      { id: 'upper-frame', label: 'Upper Frame', visualBoundary: true },
      { id: 'lower-frame', label: 'Lower Frame', visualBoundary: true }
    ],
    nodes: [
      { semanticId: 'upper', layer: 'upper-layer', group: 'upper-frame' },
      { semanticId: 'lower', layer: 'lower-layer', group: 'lower-frame' }
    ]
  };

  const scene = layoutSystemArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  assert.ok(p.get('lower').y - p.get('upper').y >= 288);
  assert.equal(scene.customData.excalidrawSkill.layout.engine, 'system-architecture-v0.2.1');
});

test('does not inflate vertical gap inside the same explicit frame', () => {
  const ids = ['upper', 'lower'];
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      layers: [
        { id: 'upper-layer', order: 0 },
        { id: 'lower-layer', order: 1 }
      ]
    },
    groups: [{ id: 'shared-frame', label: 'Shared Frame', visualBoundary: true }],
    nodes: [
      { semanticId: 'upper', layer: 'upper-layer', group: 'shared-frame' },
      { semanticId: 'lower', layer: 'lower-layer', group: 'shared-frame' }
    ]
  };

  const scene = layoutSystemArchitecture(sceneFor(ids), spec);
  const p = positions(scene);
  assert.equal(p.get('lower').y - p.get('upper').y, 180);
});

test('is a no-op for flow diagrams', () => {
  const scene = sceneFor(['a', 'b']);
  const before = JSON.stringify(scene);
  layoutSystemArchitecture(scene, { diagramType: 'service-flow', nodes: [] });
  assert.equal(JSON.stringify(scene), before);
});
