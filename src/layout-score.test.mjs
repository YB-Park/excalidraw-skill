import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLayoutCandidate } from './layout-score.mjs';

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

function edge(id, from, to, points) {
  const first = points[0];
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: first.x,
    y: first.y,
    width: points.at(-1).x - first.x,
    height: points.at(-1).y - first.y,
    points: points.map((point) => [point.x - first.x, point.y - first.y]),
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, kind: 'sync' } }
  };
}

test('clean direct layout has no hard penalty', () => {
  const scene = {
    elements: [
      node('a', 0, 0),
      node('b', 360, 0),
      edge('a-b', 'a', 'b', [{ x: 180, y: 40 }, { x: 360, y: 40 }])
    ]
  };
  const spec = {
    diagramType: 'service-flow',
    layout: { primaryFlow: ['a', 'b'] },
    nodes: [
      { semanticId: 'a', layoutHints: { lane: 'main', rank: 0 } },
      { semanticId: 'b', layoutHints: { lane: 'main', rank: 1 } }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b' }]
  };
  const score = scoreLayoutCandidate(scene, spec);
  assert.equal(score.hardPenalty, 0);
  assert.equal(score.hardPass, true);
});

test('edge-through-node is a hard failure regardless of perceptual cost', () => {
  const scene = {
    elements: [
      node('a', 0, 0),
      node('blocker', 260, 0),
      node('b', 520, 0),
      edge('a-b', 'a', 'b', [{ x: 180, y: 40 }, { x: 520, y: 40 }])
    ]
  };
  const spec = {
    diagramType: 'service-flow',
    nodes: [
      { semanticId: 'a' },
      { semanticId: 'blocker' },
      { semanticId: 'b' }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b' }]
  };
  const score = scoreLayoutCandidate(scene, spec);
  assert.equal(score.hardPass, false);
  assert.ok(score.hardPenalty >= 1_000_000);
});

test('crossings within the structural budget are represented perceptually, not as a hard penalty', () => {
  const scene = {
    elements: [
      node('a', 0, 0), node('b', 360, 240),
      node('c', 0, 240), node('d', 360, 0),
      edge('a-b', 'a', 'b', [{ x: 180, y: 40 }, { x: 270, y: 40 }, { x: 270, y: 280 }, { x: 360, y: 280 }]),
      edge('c-d', 'c', 'd', [{ x: 180, y: 280 }, { x: 310, y: 280 }, { x: 310, y: 40 }, { x: 360, y: 40 }])
    ]
  };
  const spec = {
    diagramType: 'service-flow',
    nodes: ['a', 'b', 'c', 'd'].map((semanticId) => ({ semanticId })),
    edges: [
      { semanticId: 'a-b', from: 'a', to: 'b' },
      { semanticId: 'c-d', from: 'c', to: 'd' }
    ]
  };
  const score = scoreLayoutCandidate(scene, spec);
  assert.equal(score.hardViolations.excessiveEdgeCrossings, 0);
  assert.ok(score.perceptual.metrics.edgeCrossings >= 1);
});
