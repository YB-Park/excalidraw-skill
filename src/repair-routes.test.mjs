import test from 'node:test';
import assert from 'node:assert/strict';
import { repairRoutes } from './repair-routes.mjs';
import { collinearOverlapLength, rectOf, segmentIntersectsRect, segmentsFromEdge } from './geometry.mjs';

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

function edge(id, from, to, points, route) {
  const first = points[0];
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: first.x,
    y: first.y,
    width: points.at(-1).x - first.x,
    height: points.at(-1).y - first.y,
    points: points.map((point) => [point.x - first.x, point.y - first.y]),
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, kind: 'sync', route } }
  };
}

function endpointSegment(item, nodeId) {
  const meta = item.customData.excalidrawSkill;
  const segments = segmentsFromEdge(item);
  return meta.from === nodeId ? segments[0] : segments.at(-1);
}

test('separates fallback target and outgoing endpoint segments on one node side', () => {
  const source = node('source', 0, 0);
  const events = node('events', 300, 300);
  const worker = node('worker', 620, 300);
  const blocker = node('blocker', 300, 160);

  const incoming = edge('source-events', 'source', 'events', [
    { x: 180, y: 40 },
    { x: 516, y: 40 },
    { x: 516, y: 340 },
    { x: 480, y: 340 }
  ], { sourceSide: 'right', targetSide: 'right' });
  const outgoing = edge('events-worker', 'events', 'worker', [
    { x: 480, y: 340 },
    { x: 516, y: 340 },
    { x: 620, y: 340 }
  ], { sourceSide: 'right', targetSide: 'left' });

  const scene = { elements: [source, blocker, events, worker, incoming, outgoing] };
  assert.ok(collinearOverlapLength(endpointSegment(incoming, 'events'), endpointSegment(outgoing, 'events')) > 8);

  repairRoutes(scene);

  assert.equal(collinearOverlapLength(endpointSegment(incoming, 'events'), endpointSegment(outgoing, 'events')), 0);
  assert.ok(scene.customData.excalidrawSkill.routeRepair.endpointOverlapsRepaired >= 1);
});

test('routes a lower branch around an upper sibling when the slot gap is 34px', () => {
  const aggregator = node('aggregator', 600, 0);
  const fast = node('fast', 300, 220);
  const full = node('full', 300, 334);
  const routed = edge('full-aggregator', 'full', 'aggregator', [
    { x: 390, y: 334 },
    { x: 390, y: 260 },
    { x: 690, y: 260 },
    { x: 690, y: 80 }
  ], { sourceSide: 'up', targetSide: 'down' });

  const scene = { elements: [aggregator, fast, full, routed] };
  assert.ok(segmentsFromEdge(routed).some((segment) => segmentIntersectsRect(segment, rectOf(fast, 3))));

  repairRoutes(scene);

  assert.ok(segmentsFromEdge(routed).every((segment) => !segmentIntersectsRect(segment, rectOf(fast, 3))));
  assert.equal(routed.customData.excalidrawSkill.routeRepair.nodeCrossingRepaired, true);
});
