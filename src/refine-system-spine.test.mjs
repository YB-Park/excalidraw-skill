import test from 'node:test';
import assert from 'node:assert/strict';
import { refineSystemSpine } from './refine-system-spine.mjs';

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

function label(id, x, y) {
  return {
    id: `label_${id}`,
    type: 'text',
    x,
    y,
    width: 140,
    height: 24,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

test('moves a disconnected singleton out of a dependency edge spine that bypasses its layer', () => {
  const kernel = node('kernel', 200, 100);
  const bootloader = node('bootloader', 200, 280);
  const hardware = node('hardware', 200, 460);
  const bootloaderLabel = label('bootloader', 220, 306);
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      layers: [
        { id: 'kernel', order: 0 },
        { id: 'bootloader', order: 1 },
        { id: 'hardware', order: 2 }
      ]
    },
    nodes: [
      { semanticId: 'kernel', layer: 'kernel' },
      { semanticId: 'bootloader', layer: 'bootloader' },
      { semanticId: 'hardware', layer: 'hardware' }
    ],
    edges: [{ semanticId: 'kernel-hardware', from: 'kernel', to: 'hardware' }]
  };
  const scene = { elements: [kernel, bootloader, bootloaderLabel, hardware] };

  refineSystemSpine(scene, spec);

  assert.equal(kernel.x, hardware.x);
  assert.notEqual(bootloader.x, kernel.x);
  assert.equal(bootloaderLabel.x - 220, bootloader.x - 200);
  assert.equal(scene.customData.excalidrawSkill.systemSpineRefinement.moved, 1);
  assert.deepEqual(scene.customData.excalidrawSkill.systemSpineRefinement.decisions[0].bypassEdges, ['kernel-hardware']);
});

test('does not move a connected intermediate layer node', () => {
  const kernel = node('kernel', 200, 100);
  const bootloader = node('bootloader', 200, 280);
  const hardware = node('hardware', 200, 460);
  const spec = {
    diagramType: 'system-architecture',
    layout: { profile: 'layered-system' },
    architecture: {
      layers: [
        { id: 'kernel', order: 0 },
        { id: 'bootloader', order: 1 },
        { id: 'hardware', order: 2 }
      ]
    },
    nodes: [
      { semanticId: 'kernel', layer: 'kernel' },
      { semanticId: 'bootloader', layer: 'bootloader' },
      { semanticId: 'hardware', layer: 'hardware' }
    ],
    edges: [
      { from: 'kernel', to: 'bootloader' },
      { from: 'bootloader', to: 'hardware' }
    ]
  };

  refineSystemSpine({ elements: [kernel, bootloader, hardware] }, spec);

  assert.equal(bootloader.x, 200);
});
