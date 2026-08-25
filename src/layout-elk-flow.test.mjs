import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutElkFlow, toElkGraph } from './layout-elk-flow.mjs';

function sceneNode(id, x = 0, y = 0) {
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

function sceneLabel(id, x = 20, y = 20) {
  return {
    id: `label_${id}`,
    type: 'text',
    x,
    y,
    width: 140,
    height: 30,
    text: id,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

function sceneEdge(id, from, to) {
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [[0, 0], [0, 0]],
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } }
  };
}

const spec = {
  layout: {
    primaryFlow: ['a', 'b'],
    lanes: [
      { id: 'main', order: 0 },
      { id: 'support', order: 1 }
    ]
  },
  nodes: [
    { semanticId: 'a', layoutHints: { lane: 'main', rank: 0 } },
    { semanticId: 'b', layoutHints: { lane: 'main', rank: 1 } },
    { semanticId: 'audit', layoutHints: { lane: 'support', rank: 1 } }
  ],
  edges: [
    { semanticId: 'a-b', from: 'a', to: 'b', routeHints: { direction: 'right', priority: 'primary' } },
    { semanticId: 'a-audit', from: 'a', to: 'audit', routeHints: { direction: 'down' } }
  ]
};

test('maps semantic rank and route hints into ELK partitions and fixed port sides', () => {
  const scene = {
    elements: [sceneNode('a'), sceneNode('b'), sceneNode('audit'), sceneEdge('a-b', 'a', 'b'), sceneEdge('a-audit', 'a', 'audit')]
  };
  const graph = toElkGraph(scene, spec);
  const a = graph.children.find((node) => node.id === 'a');
  const b = graph.children.find((node) => node.id === 'b');
  assert.equal(a.layoutOptions['elk.partitioning.partition'], '0');
  assert.equal(b.layoutOptions['elk.partitioning.partition'], '1');
  assert.ok(a.ports.some((port) => port.layoutOptions['elk.port.side'] === 'EAST'));
  assert.ok(a.ports.some((port) => port.layoutOptions['elk.port.side'] === 'SOUTH'));
  assert.equal(graph.layoutOptions['elk.edgeRouting'], 'ORTHOGONAL');
  assert.equal(graph.layoutOptions['elk.randomSeed'], '1');
});

test('lays out a small flow deterministically and moves labels with nodes', async () => {
  const makeScene = () => ({
    elements: [
      sceneNode('a'), sceneLabel('a'),
      sceneNode('b'), sceneLabel('b'),
      sceneNode('audit'), sceneLabel('audit'),
      sceneEdge('a-b', 'a', 'b'),
      sceneEdge('a-audit', 'a', 'audit')
    ]
  });
  const first = await layoutElkFlow(makeScene(), spec);
  const second = await layoutElkFlow(makeScene(), spec);
  const positions = (scene) => scene.elements
    .filter((element) => element.customData?.excalidrawSkill?.role === 'node')
    .map((element) => [element.customData.excalidrawSkill.semanticId, element.x, element.y]);
  assert.deepEqual(positions(first), positions(second));
  const a = first.elements.find((element) => element.id === 'node_a');
  const b = first.elements.find((element) => element.id === 'node_b');
  const labelA = first.elements.find((element) => element.id === 'label_a');
  assert.ok(b.x > a.x);
  assert.ok(labelA.x > 20 || labelA.y > 20);
  const primary = first.elements.find((element) => element.id === 'edge_a-b');
  assert.ok(primary.points.length >= 2);
  assert.equal(first.customData.excalidrawSkill.layoutResearch.engine, 'elk-layered');
});
