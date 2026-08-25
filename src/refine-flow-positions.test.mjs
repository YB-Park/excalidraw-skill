import test from 'node:test';
import assert from 'node:assert/strict';
import { refineFlowPositions } from './refine-flow-positions.mjs';

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

test('is a no-op outside flow families', () => {
  const scene = { elements: [node('a', 0, 0)] };
  assert.equal(refineFlowPositions(scene, { diagramType: 'module-architecture' }), scene);
});

test('refinement is deterministic, bounded, and never selects a worse score', () => {
  const makeScene = () => ({
    elements: [
      node('source', 0, 100), label('source', 30, 120),
      node('support', 300, 380), label('support', 330, 400),
      node('target', 620, 100), label('target', 650, 120),
      edge('source-target', 'source', 'target'),
      edge('source-support', 'source', 'support'),
      edge('support-target', 'support', 'target')
    ]
  });
  const spec = {
    diagramType: 'service-flow',
    layout: { direction: 'left-to-right', primaryFlow: ['source', 'target'] },
    nodes: [
      { semanticId: 'source', layoutHints: { lane: 'main', rank: 0 } },
      { semanticId: 'target', layoutHints: { lane: 'main', rank: 2 } },
      { semanticId: 'support', layoutHints: { lane: 'support', rank: 1 } }
    ],
    edges: [
      { semanticId: 'source-target', from: 'source', to: 'target', routeHints: { priority: 'primary', direction: 'right' } },
      { semanticId: 'source-support', from: 'source', to: 'support', routeHints: { priority: 'secondary', direction: 'down' } },
      { semanticId: 'support-target', from: 'support', to: 'target', routeHints: { priority: 'secondary', direction: 'up' } }
    ]
  };
  const first = refineFlowPositions(makeScene(), spec);
  const second = refineFlowPositions(makeScene(), spec);
  const firstMeta = first.customData.excalidrawSkill.positionRefinement;
  const secondMeta = second.customData.excalidrawSkill.positionRefinement;
  assert.deepEqual(firstMeta, secondMeta);
  assert.ok(firstMeta.selectedCost <= firstMeta.baselineCost);
  const support = first.elements.find((element) => element.id === 'node_support');
  assert.ok(Math.abs(support.y - 380) <= 140);
});
