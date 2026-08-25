import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeFlowLayout, permutations } from './optimize-flow-layout.mjs';

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
    width: 120,
    height: 30,
    text: id,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

function edge(id, from, to) {
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [[0, 0], [0, 0]],
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, kind: 'sync' } }
  };
}

test('permutations is deterministic and exhaustive for a small group', () => {
  const result = permutations(['a', 'b', 'c']);
  assert.equal(result.length, 6);
  assert.deepEqual(result[0], ['a', 'b', 'c']);
  assert.deepEqual(result.at(-1), ['c', 'b', 'a']);
});

test('optimizer is a no-op for non-flow families', () => {
  const scene = { elements: [node('a', 0, 0)] };
  const result = optimizeFlowLayout(scene, { diagramType: 'system-architecture', nodes: [] });
  assert.equal(result, scene);
});

test('optimizer records a deterministic decision for same-lane same-rank nodes', () => {
  const scene = {
    elements: [
      node('source', 0, 0), label('source', 30, 20),
      node('left', 260, 180), label('left', 290, 200),
      node('right', 260, 300), label('right', 290, 320),
      node('target', 560, 0), label('target', 590, 20),
      edge('source-left', 'source', 'left'),
      edge('source-right', 'source', 'right'),
      edge('left-target', 'left', 'target'),
      edge('right-target', 'right', 'target')
    ]
  };
  const spec = {
    diagramType: 'service-flow',
    layout: { primaryFlow: ['source', 'target'] },
    nodes: [
      { semanticId: 'source', layoutHints: { lane: 'main', rank: 0 } },
      { semanticId: 'target', layoutHints: { lane: 'main', rank: 2 } },
      { semanticId: 'left', layoutHints: { lane: 'branch', rank: 1 } },
      { semanticId: 'right', layoutHints: { lane: 'branch', rank: 1 } }
    ],
    edges: [
      { semanticId: 'source-left', from: 'source', to: 'left', routeHints: { direction: 'down' } },
      { semanticId: 'source-right', from: 'source', to: 'right', routeHints: { direction: 'down' } },
      { semanticId: 'left-target', from: 'left', to: 'target', routeHints: { direction: 'up' } },
      { semanticId: 'right-target', from: 'right', to: 'target', routeHints: { direction: 'up' } }
    ]
  };
  const first = optimizeFlowLayout(JSON.parse(JSON.stringify(scene)), spec);
  const second = optimizeFlowLayout(JSON.parse(JSON.stringify(scene)), spec);
  assert.deepEqual(
    first.customData.excalidrawSkill.flowOptimization,
    second.customData.excalidrawSkill.flowOptimization
  );
  assert.equal(first.customData.excalidrawSkill.flowOptimization.groupsConsidered, 1);
  assert.ok(first.customData.excalidrawSkill.flowOptimization.selectedCost <= first.customData.excalidrawSkill.flowOptimization.baselineCost);
});
