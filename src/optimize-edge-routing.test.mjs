import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeEdgeRouting, routingBundles } from './optimize-edge-routing.mjs';

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

test('is a no-op for non-flow diagrams', () => {
  const scene = { elements: [node('a', 0, 0)] };
  assert.equal(optimizeEdgeRouting(scene, { diagramType: 'system-architecture' }), scene);
});

test('keeps primary directions out of secondary route search', () => {
  const scene = {
    elements: [
      node('a', 0, 0),
      node('b', 360, 0),
      edge('a-b', 'a', 'b')
    ]
  };
  const spec = {
    diagramType: 'service-flow',
    layout: { primaryFlow: ['a', 'b'] },
    nodes: [
      { semanticId: 'a', layoutHints: { lane: 'main', rank: 0 } },
      { semanticId: 'b', layoutHints: { lane: 'main', rank: 1 } }
    ],
    edges: [
      { semanticId: 'a-b', from: 'a', to: 'b', routeHints: { direction: 'right', priority: 'primary' } }
    ]
  };
  const result = optimizeEdgeRouting(scene, spec);
  assert.equal(result.customData?.excalidrawSkill?.routeOptimization, undefined);
});

test('detects deterministic fan-out and fan-in secondary bundles', () => {
  const edges = [
    { semanticId: 'router-a', from: 'router', to: 'a' },
    { semanticId: 'router-b', from: 'router', to: 'b' },
    { semanticId: 'a-aggregate', from: 'a', to: 'aggregate' },
    { semanticId: 'b-aggregate', from: 'b', to: 'aggregate' }
  ];
  assert.deepEqual(routingBundles(edges), [
    { kind: 'fan-in', node: 'aggregate', edgeIds: ['a-aggregate', 'b-aggregate'] },
    { kind: 'fan-out', node: 'router', edgeIds: ['router-a', 'router-b'] }
  ]);
});

test('secondary route search is deterministic and never increases selected cost', () => {
  const makeScene = () => ({
    elements: [
      node('source', 0, 0),
      node('support', 300, 220),
      node('target', 620, 0),
      edge('source-target', 'source', 'target'),
      edge('source-support', 'source', 'support')
    ]
  });
  const spec = {
    diagramType: 'service-flow',
    layout: { primaryFlow: ['source', 'target'] },
    nodes: [
      { semanticId: 'source', layoutHints: { lane: 'main', rank: 0 } },
      { semanticId: 'target', layoutHints: { lane: 'main', rank: 2 } },
      { semanticId: 'support', layoutHints: { lane: 'support', rank: 1 } }
    ],
    edges: [
      { semanticId: 'source-target', from: 'source', to: 'target', routeHints: { direction: 'right', priority: 'primary' } },
      { semanticId: 'source-support', from: 'source', to: 'support', routeHints: { direction: 'down', priority: 'secondary' } }
    ]
  };
  const first = optimizeEdgeRouting(makeScene(), spec);
  const second = optimizeEdgeRouting(makeScene(), spec);
  assert.deepEqual(
    first.customData.excalidrawSkill.routeOptimization,
    second.customData.excalidrawSkill.routeOptimization
  );
  const meta = first.customData.excalidrawSkill.routeOptimization;
  assert.equal(meta.edgesConsidered, 1);
  assert.equal(meta.bundlesConsidered, 0);
  assert.ok(meta.selectedCost <= meta.baselineCost);
});
