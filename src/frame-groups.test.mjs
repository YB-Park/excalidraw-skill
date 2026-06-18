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

test('does not auto-frame groups with one or two nodes', () => {
  const scene = { elements: [node('a'), node('b', 300), node('c', 600), node('d', 900), node('e', 1200)] };
  const spec = { nodes: [
    { semanticId: 'a', group: 'one' },
    { semanticId: 'b', group: 'two' },
    { semanticId: 'c', group: 'two' },
    { semanticId: 'd' },
    { semanticId: 'e' }
  ] };
  assert.equal(frames(frameSceneGroups(scene, spec)).length, 0);
});

test('auto frame defaults to one region for a medium diagram', () => {
  const elements = [];
  const nodes = [];
  for (let i = 0; i < 3; i += 1) {
    elements.push(node(`core${i}`, i * 220));
    nodes.push({ semanticId: `core${i}`, group: 'core' });
  }
  for (let i = 0; i < 3; i += 1) {
    elements.push(node(`support${i}`, 900 + i * 220));
    nodes.push({ semanticId: `support${i}`, group: 'support' });
  }
  elements.push(node('free', 1800));
  nodes.push({ semanticId: 'free' });
  const result = frameSceneGroups({ elements }, { nodes });
  assert.equal(frames(result).length, 1);
  assert.equal(result.customData.excalidrawSkill.framePolicy.suppressedByBudget, 1);
});

test('explicit definitions suppress unspecified logical groups', () => {
  const scene = { elements: [
    node('a'), node('b', 220), node('c', 440),
    node('d', 660), node('e', 880), node('f', 1100)
  ] };
  const spec = {
    groups: [{ id: 'external', label: 'External', visualBoundary: true }],
    nodes: [
      { semanticId: 'a', group: 'external' },
      { semanticId: 'b', group: 'external' },
      { semanticId: 'c', group: 'internal' },
      { semanticId: 'd', group: 'internal' },
      { semanticId: 'e', group: 'internal' },
      { semanticId: 'f' }
    ]
  };
  const result = frameSceneGroups(scene, spec);
  assert.equal(frames(result).length, 1);
  assert.equal(frames(result)[0].name, 'External');
  assert.equal(result.customData.excalidrawSkill.framePolicy.suppressedUnspecifiedGroups, 1);
});

test('does not frame the whole scene by default', () => {
  const scene = { elements: [node('a'), node('b', 220), node('c', 440), node('d', 660), node('e', 880)] };
  const spec = { nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ semanticId: id, group: 'all' })) };
  assert.equal(frames(frameSceneGroups(scene, spec)).length, 0);
});

test('respects explicit maxFrames override', () => {
  const elements = [];
  const nodes = [];
  for (let group = 0; group < 3; group += 1) {
    for (let index = 0; index < 3; index += 1) {
      const id = `g${group}-${index}`;
      elements.push(node(id, group * 900 + index * 220));
      nodes.push({ semanticId: id, group: `g${group}` });
    }
  }
  elements.push(node('free', 3000));
  nodes.push({ semanticId: 'free' });
  const result = frameSceneGroups({ elements }, { nodes, framePolicy: { maxFrames: 2 } });
  assert.equal(frames(result).length, 2);
});
