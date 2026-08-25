import test from 'node:test';
import assert from 'node:assert/strict';
import { repairFlowBundles } from './repair-flow-bundles.mjs';
import { segmentsFromEdge, segmentsIntersect } from './geometry.mjs';

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
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, route: { sourceSide: 'down', targetSide: 'up' } } }
  };
}

function crossings(edges) {
  let count = 0;
  for (let first = 0; first < edges.length; first += 1) {
    for (let second = first + 1; second < edges.length; second += 1) {
      for (const a of segmentsFromEdge(edges[first])) {
        for (const b of segmentsFromEdge(edges[second])) {
          if (segmentsIntersect(a, b, { includeEndpoints: false })) count += 1;
        }
      }
    }
  }
  return count;
}

function specForFanOut() {
  return {
    diagramType: 'service-flow',
    layout: { profile: 'swimlane-flow', direction: 'left-to-right', primaryFlow: [] },
    nodes: [
      { semanticId: 'router', layoutHints: { lane: 'main', rank: 1 } },
      { semanticId: 'a', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'b', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'c', layoutHints: { lane: 'branch', rank: 2 } }
    ],
    edges: [
      { semanticId: 'router-a', from: 'router', to: 'a', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'router-b', from: 'router', to: 'b', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'router-c', from: 'router', to: 'c', routeHints: { direction: 'down', priority: 'secondary' } }
    ]
  };
}

function specForFanIn() {
  return {
    diagramType: 'service-flow',
    layout: { profile: 'swimlane-flow', direction: 'left-to-right', primaryFlow: [] },
    nodes: [
      { semanticId: 'aggregate', layoutHints: { lane: 'main', rank: 3 } },
      { semanticId: 'a', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'b', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'c', layoutHints: { lane: 'branch', rank: 2 } }
    ],
    edges: [
      { semanticId: 'a-aggregate', from: 'a', to: 'aggregate', routeHints: { direction: 'up', priority: 'secondary' } },
      { semanticId: 'b-aggregate', from: 'b', to: 'aggregate', routeHints: { direction: 'up', priority: 'secondary' } },
      { semanticId: 'c-aggregate', from: 'c', to: 'aggregate', routeHints: { direction: 'up', priority: 'secondary' } }
    ]
  };
}

test('replaces a diagonal stacked fan-out with nested one-bend routes without crossings', () => {
  const router = node('router', 0, 0);
  const a = node('a', 420, 180);
  const b = node('b', 420, 320);
  const c = node('c', 420, 460);
  const routed = [
    edge('router-a', 'router', 'a', [
      { x: 90, y: 80 }, { x: 90, y: 120 }, { x: 620, y: 120 }, { x: 620, y: 160 }, { x: 510, y: 160 }, { x: 510, y: 180 }
    ]),
    edge('router-b', 'router', 'b', [
      { x: 74, y: 80 }, { x: 74, y: 130 }, { x: 650, y: 130 }, { x: 650, y: 300 }, { x: 510, y: 300 }, { x: 510, y: 320 }
    ]),
    edge('router-c', 'router', 'c', [
      { x: 106, y: 80 }, { x: 106, y: 140 }, { x: 680, y: 140 }, { x: 680, y: 440 }, { x: 510, y: 440 }, { x: 510, y: 460 }
    ])
  ];
  const scene = { elements: [router, a, b, c, ...routed] };

  const result = repairFlowBundles(scene, specForFanOut());
  const repaired = result.elements.filter((element) => element.customData?.excalidrawSkill?.role === 'edge');

  assert.equal(result.customData.excalidrawSkill.flowBundleRepair.accepted, 1);
  assert.equal(crossings(repaired), 0);
  for (const item of repaired) {
    assert.equal(item.points.length, 3);
    assert.equal(item.customData.excalidrawSkill.route.bends, 1);
    assert.equal(item.customData.excalidrawSkill.flowBundleRepair.engine, 'flow-bundle-v0.1');
  }
  const fractions = repaired
    .sort((x, y) => x.customData.excalidrawSkill.semanticId.localeCompare(y.customData.excalidrawSkill.semanticId))
    .map((item) => item.customData.excalidrawSkill.flowBundleRepair.portFraction);
  assert.ok(new Set(fractions).size === 3);
});

test('replaces a stacked fan-in below-left of its aggregator with nested one-bend routes without crossings', () => {
  const aggregate = node('aggregate', 720, 0);
  const a = node('a', 420, 140);
  const b = node('b', 420, 300);
  const c = node('c', 420, 460);
  const routed = [
    edge('a-aggregate', 'a', 'aggregate', [
      { x: 510, y: 140 }, { x: 510, y: 110 }, { x: 800, y: 110 }, { x: 800, y: 80 }
    ]),
    edge('b-aggregate', 'b', 'aggregate', [
      { x: 510, y: 300 }, { x: 510, y: 260 }, { x: 820, y: 260 }, { x: 820, y: 80 }
    ]),
    edge('c-aggregate', 'c', 'aggregate', [
      { x: 510, y: 460 }, { x: 510, y: 420 }, { x: 840, y: 420 }, { x: 840, y: 80 }
    ])
  ];
  const scene = { elements: [aggregate, a, b, c, ...routed] };

  const result = repairFlowBundles(scene, specForFanIn());
  const repaired = result.elements.filter((element) => element.customData?.excalidrawSkill?.role === 'edge');

  assert.equal(result.customData.excalidrawSkill.flowBundleRepair.accepted, 1);
  assert.equal(crossings(repaired), 0);
  for (const item of repaired) {
    assert.equal(item.points.length, 3);
    assert.equal(item.customData.excalidrawSkill.route.bends, 1);
    assert.equal(item.customData.excalidrawSkill.route.sourceSide, 'right');
    assert.equal(item.customData.excalidrawSkill.route.targetSide, 'down');
  }
  const bySourceY = [...repaired].sort((x, y) => x.y - y.y);
  const fractions = bySourceY.map((item) => item.customData.excalidrawSkill.flowBundleRepair.portFraction);
  assert.ok(fractions[0] < fractions[1] && fractions[1] < fractions[2]);
});

test('leaves non-diagonal fan-out geometry untouched', () => {
  const router = node('router', 0, 0);
  const a = node('a', 0, 220);
  const b = node('b', 0, 360);
  const c = node('c', 0, 500);
  const routed = [
    edge('router-a', 'router', 'a', [{ x: 90, y: 80 }, { x: 90, y: 220 }]),
    edge('router-b', 'router', 'b', [{ x: 90, y: 80 }, { x: 90, y: 360 }]),
    edge('router-c', 'router', 'c', [{ x: 90, y: 80 }, { x: 90, y: 500 }])
  ];
  const scene = { elements: [router, a, b, c, ...routed] };
  const before = JSON.stringify(scene.elements.filter((element) => element.type === 'arrow').map((item) => item.points));

  const result = repairFlowBundles(scene, specForFanOut());

  assert.equal(result.customData.excalidrawSkill.flowBundleRepair.accepted, 0);
  assert.equal(JSON.stringify(result.elements.filter((element) => element.type === 'arrow').map((item) => item.points)), before);
});
