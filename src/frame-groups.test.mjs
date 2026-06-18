import test from 'node:test';
import assert from 'node:assert/strict';
import { frameSceneGroups } from './frame-groups.mjs';

function node(id, x = 0, y = 0) {
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

function frames(scene) {
  return scene.elements.filter((element) => element.customData?.excalidrawSkill?.role === 'frame');
}

test('suppresses singleton groups', () => {
  const nodes = Array.from({ length: 8 }, (_, index) => node(`n${index}`, index * 220, 0));
  const specNodes = nodes.map((element, index) => ({
    semanticId: element.customData.excalidrawSkill.semanticId,
    group: index < 2 ? 'Core' : `Area ${index}`
  }));
  const result = frameSceneGroups({ elements: nodes }, { nodes: specNodes });
  assert.equal(frames(result).length, 1);
  assert.equal(frames(result)[0].name, 'Core');
  assert.equal(result.customData.excalidrawSkill.framePolicy.suppressedSingletons, 6);
});

test('caps automatic frames based on node count', () => {
  const nodes = Array.from({ length: 8 }, (_, index) => node(`n${index}`, (index % 4) * 220, Math.floor(index / 4) * 160));
  const specNodes = nodes.map((element, index) => ({ semanticId: element.customData.excalidrawSkill.semanticId, group: `Pair ${Math.floor(index / 2)}` }));
  const result = frameSceneGroups({ elements: nodes }, { nodes: specNodes });
  assert.equal(frames(result).length, 2);
  assert.equal(result.customData.excalidrawSkill.framePolicy.budget, 2);
});

test('does not frame the entire scene by default', () => {
  const nodes = [node('a'), node('b', 220, 0), node('c', 440, 0)];
  const result = frameSceneGroups({ elements: nodes }, { nodes: nodes.map((element) => ({ semanticId: element.customData.excalidrawSkill.semanticId, group: 'Whole Diagram' })) });
  assert.equal(frames(result).length, 0);
});

test('allows an explicit larger frame budget', () => {
  const nodes = Array.from({ length: 8 }, (_, index) => node(`n${index}`));
  const specNodes = nodes.map((element, index) => ({ semanticId: element.customData.excalidrawSkill.semanticId, group: `Pair ${Math.floor(index / 2)}` }));
  const result = frameSceneGroups({ elements: nodes }, { nodes: specNodes, framePolicy: { maxFrames: 4 } });
  assert.equal(frames(result).length, 4);
});
