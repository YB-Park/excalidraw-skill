import test from 'node:test';
import assert from 'node:assert/strict';
import { refineModuleLabelCorridors } from './refine-module-label-corridors.mjs';

function node(id, x, scope) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x,
    y: 200,
    width: 180,
    height: 80,
    customData: { excalidrawSkill: { role: 'node', semanticId: id, moduleScope: scope } }
  };
}

function label(id, x) {
  return {
    id: `label_${id}`,
    type: 'text',
    x,
    y: 220,
    width: 120,
    height: 22,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

test('widens a hub-grid right column and moves right external nodes with it', () => {
  const hub = node('controller', 380, 'internal');
  const adapter = node('adapter', 650, 'internal');
  const provider = node('provider', 1050, 'external');
  const adapterLabel = label('adapter', 680);
  const scene = {
    elements: [hub, adapter, provider, adapterLabel],
    customData: { excalidrawSkill: { layout: {
      strategy: 'hub-grid',
      hubId: 'controller',
      boundary: { x: 320, y: 140, width: 510, height: 500 }
    } } }
  };

  refineModuleLabelCorridors(scene, { diagramType: 'module-architecture' });

  assert.equal(adapter.x - (hub.x + hub.width), 220);
  assert.equal(adapter.x, 780);
  assert.equal(provider.x, 1180);
  assert.equal(adapterLabel.x, 810);
  assert.equal(scene.customData.excalidrawSkill.layout.boundary.width, 640);
  assert.equal(scene.customData.excalidrawSkill.moduleLabelCorridors.appliedShift, 130);
});

test('is a no-op outside module hub grids', () => {
  const hub = node('controller', 380, 'internal');
  const scene = { elements: [hub], customData: { excalidrawSkill: { layout: { strategy: 'compact-grid' } } } };
  const before = JSON.stringify(scene);
  refineModuleLabelCorridors(scene, { diagramType: 'module-architecture' });
  assert.equal(JSON.stringify(scene), before);
});
