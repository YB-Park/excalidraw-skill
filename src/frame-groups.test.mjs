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

function framePolicy(scene) {
  return scene.customData?.excalidrawSkill?.framePolicy;
}

function rightOf(frame) {
  return frame.x + frame.width;
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
  const result = frameSceneGroups(scene, spec);
  assert.equal(frames(result).length, 0);
  assert.equal(framePolicy(result).candidateCount, 0);
  assert.equal(framePolicy(result).renderedCount, 0);
  assert.equal(framePolicy(result).suppressedFullScene, 1);
});

test('explicit visual boundary can frame the whole scene', () => {
  const scene = { elements: [node('a'), node('b', 220), node('c', 440)] };
  const spec = {
    groups: [{ id: 'runtime-boundary', label: 'Runtime Boundary', visualBoundary: true }],
    nodes: ['a', 'b', 'c'].map((id) => ({ semanticId: id, group: 'runtime-boundary' }))
  };
  const result = frameSceneGroups(scene, spec);
  const renderedFrames = frames(result);

  assert.equal(renderedFrames.length, 1);
  assert.equal(renderedFrames[0].name, 'Runtime Boundary');
  assert.equal(renderedFrames[0].customData.excalidrawSkill.semanticId, 'runtime-boundary');
  assert.equal(renderedFrames[0].customData.excalidrawSkill.frameMode, 'explicit');
  assert.equal(renderedFrames[0].customData.excalidrawSkill.memberCount, 3);
  assert.equal(framePolicy(result).candidateCount, 1);
  assert.equal(framePolicy(result).renderedCount, 1);
  assert.equal(framePolicy(result).suppressedFullScene, 0);
});

test('framePolicy.include can explicitly frame the whole scene', () => {
  const scene = { elements: [node('a'), node('b', 220), node('c', 440)] };
  const spec = {
    framePolicy: { include: ['system-context'] },
    nodes: ['a', 'b', 'c'].map((id) => ({ semanticId: id, group: 'system-context' }))
  };
  const result = frameSceneGroups(scene, spec);
  const renderedFrames = frames(result);

  assert.equal(renderedFrames.length, 1);
  assert.equal(renderedFrames[0].customData.excalidrawSkill.semanticId, 'system-context');
  assert.equal(renderedFrames[0].customData.excalidrawSkill.frameMode, 'explicit');
  assert.equal(framePolicy(result).candidateCount, 1);
  assert.equal(framePolicy(result).renderedCount, 1);
  assert.equal(framePolicy(result).suppressedFullScene, 0);
});

test('one-member frames use larger padding when allowed', () => {
  const scene = { elements: [node('x', 100, 120)] };
  const spec = {
    framePolicy: { allowSingletons: true },
    groups: [{ id: 'x-frame', label: 'X Frame', visualBoundary: true }],
    nodes: [{ semanticId: 'x', group: 'x-frame' }]
  };
  const result = frameSceneGroups(scene, spec);
  const [frame] = frames(result);

  assert.equal(frame.customData.excalidrawSkill.padding, 80);
  assert.equal(frame.x, 20);
  assert.equal(frame.y, 40);
  assert.equal(frame.width, 340);
  assert.equal(frame.height, 240);
});

test('multi-node frames keep standard padding', () => {
  const scene = { elements: [node('a', 100, 120), node('b', 320, 120)] };
  const spec = {
    groups: [{ id: 'pair-frame', label: 'Pair Frame', visualBoundary: true }],
    nodes: [
      { semanticId: 'a', group: 'pair-frame' },
      { semanticId: 'b', group: 'pair-frame' }
    ]
  };
  const result = frameSceneGroups(scene, spec);
  const [frame] = frames(result);

  assert.equal(frame.customData.excalidrawSkill.padding, 48);
  assert.equal(frame.x, 52);
  assert.equal(frame.y, 72);
});

test('separates overlapping explicit frame padding without moving member nodes', () => {
  const scene = { elements: [node('left', 100, 120), node('right', 310, 120)] };
  const spec = {
    framePolicy: { allowSingletons: true },
    groups: [
      { id: 'left-frame', label: 'Left Frame', visualBoundary: true },
      { id: 'right-frame', label: 'Right Frame', visualBoundary: true }
    ],
    nodes: [
      { semanticId: 'left', group: 'left-frame' },
      { semanticId: 'right', group: 'right-frame' }
    ]
  };
  const result = frameSceneGroups(scene, spec);
  const rendered = frames(result).sort((a, b) => a.x - b.x);

  assert.equal(rendered.length, 2);
  assert.ok(rightOf(rendered[0]) + 16 <= rendered[1].x);
  assert.ok(rendered[0].x <= 100);
  assert.ok(rightOf(rendered[0]) >= 280);
  assert.ok(rendered[1].x <= 310);
  assert.equal(framePolicy(result).adjustedFrameCollisions, 1);
  assert.equal(framePolicy(result).unresolvedFrameCollisions, 0);
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
