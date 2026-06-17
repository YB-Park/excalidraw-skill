import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEdges } from './route-edges.mjs';
import { rectOf, segmentIntersectsRect, segmentsFromEdge } from './geometry.mjs';

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

test('approaches a vertically aligned target from the side when blocked above', () => {
  const source = node('source', 300, 0);
  const blocker = node('blocker', 300, 190);
  const target = node('target', 300, 330);
  const routed = edge('source-target', 'source', 'target');

  routeEdges(
    { elements: [source, blocker, target, routed] },
    {
      edges: [{
        semanticId: 'source-target',
        from: 'source',
        to: 'target',
        routeHints: { direction: 'down' }
      }]
    }
  );

  assert.ok(
    segmentsFromEdge(routed).every(
      (segment) => !segmentIntersectsRect(segment, rectOf(blocker, 10))
    )
  );

  const endpoint = segmentsFromEdge(routed).at(-1).b;
  assert.ok(endpoint.x === target.x || endpoint.x === target.x + target.width);
});
