import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutServiceFlow } from './layout-service-flow.mjs';
import { routeEdges } from './route-edges.mjs';
import { absolutePoints } from './geometry.mjs';

function sceneFor(nodes) {
  const elements = [];
  nodes.forEach((node, index) => {
    elements.push({
      id: `node_${node.semanticId}`,
      type: 'rectangle',
      x: 100 + index * 260,
      y: 120,
      width: node.width ?? 180,
      height: node.height ?? 80,
      customData: { excalidrawSkill: { role: 'node', semanticId: node.semanticId } }
    });
    elements.push({
      id: `label_${node.semanticId}`,
      type: 'text',
      x: 116 + index * 260,
      y: 146,
      width: 148,
      height: 28,
      customData: { excalidrawSkill: { role: 'label', node: node.semanticId } }
    });
  });
  return { type: 'excalidraw', elements };
}

function edgeElement(edge) {
  const semanticId = edge.semanticId ?? `${edge.from}-${edge.to}`;
  return {
    id: `edge_${semanticId}`,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [[0, 0], [0, 0]],
    customData: { excalidrawSkill: { role: 'edge', semanticId, from: edge.from, to: edge.to, kind: 'sync' } }
  };
}

function positions(scene) {
  return new Map(scene.elements
    .filter((element) => element.customData?.excalidrawSkill?.role === 'node')
    .map((element) => [element.customData.excalidrawSkill.semanticId, { x: element.x, y: element.y, width: element.width, height: element.height }]));
}

function centerX(position) {
  return position.x + position.width / 2;
}

test('swimlane-flow separates support nodes and preserves ranks', () => {
  const nodes = [
    { semanticId: 'web', layoutHints: { lane: 'main', rank: 1, importance: 'primary' } },
    { semanticId: 'api', layoutHints: { lane: 'main', rank: 2, importance: 'primary' } },
    { semanticId: 'pay', layoutHints: { lane: 'main', rank: 3, importance: 'primary' } },
    { semanticId: 'network', layoutHints: { lane: 'main', rank: 4, importance: 'primary' } },
    { semanticId: 'fraud', layoutHints: { lane: 'support', rank: 3, importance: 'secondary' } },
    { semanticId: 'db', layoutHints: { lane: 'support', rank: 3, importance: 'secondary' } },
    { semanticId: 'events', layoutHints: { lane: 'support', rank: 4, importance: 'support' } }
  ];
  const spec = {
    diagramType: 'service-flow',
    version: '2.0',
    nodes,
    edges: [],
    layout: {
      profile: 'swimlane-flow',
      direction: 'left-to-right',
      primaryFlow: ['web', 'api', 'pay', 'network'],
      lanes: [
        { id: 'main', position: 'center', order: 1 },
        { id: 'support', position: 'bottom', order: 2 }
      ]
    }
  };
  const scene = layoutServiceFlow(sceneFor(nodes), spec);
  const placed = positions(scene);
  assert.equal(placed.get('web').x, 120);
  assert.ok(placed.get('web').x < placed.get('api').x && placed.get('api').x < placed.get('pay').x);
  assert.equal(placed.get('web').y, placed.get('pay').y);
  assert.ok(placed.get('fraud').y > placed.get('pay').y);
  assert.equal(placed.get('fraud').x, placed.get('pay').x);
  assert.notEqual(placed.get('fraud').y, placed.get('db').y);
  assert.equal(scene.customData.excalidrawSkill.layout.profile, 'swimlane-flow');
  assert.equal(scene.customData.excalidrawSkill.layout.family, 'flow');
  assert.equal(scene.customData.excalidrawSkill.layout.subtype, 'service-flow');
});

test('top-to-bottom swimlane stacks same-lane nodes on a shared vertical spine', () => {
  const nodes = [
    { semanticId: 'ingress', width: 220, layoutHints: { lane: 'main', rank: 0, importance: 'primary' } },
    { semanticId: 'api', width: 150, layoutHints: { lane: 'main', rank: 1, importance: 'primary' } },
    { semanticId: 'worker', width: 260, layoutHints: { lane: 'main', rank: 2, importance: 'primary' } }
  ];
  const edges = [
    { semanticId: 'ingress-api', from: 'ingress', to: 'api' },
    { semanticId: 'api-worker', from: 'api', to: 'worker' }
  ];
  const spec = {
    diagramType: 'service-flow',
    version: '2.0',
    nodes,
    edges,
    layout: {
      profile: 'swimlane-flow',
      direction: 'top-to-bottom',
      primaryFlow: ['ingress', 'api', 'worker'],
      lanes: [{ id: 'main', position: 'center', order: 0 }]
    }
  };
  const scene = sceneFor(nodes);
  scene.elements.push(...edges.map(edgeElement));
  layoutServiceFlow(scene, spec);
  routeEdges(scene, spec);

  const placed = positions(scene);
  assert.equal(centerX(placed.get('ingress')), centerX(placed.get('api')));
  assert.equal(centerX(placed.get('api')), centerX(placed.get('worker')));
  assert.equal(placed.get('api').y - placed.get('ingress').y, 176);
  const first = scene.elements.find((element) => element.id === 'edge_ingress-api');
  const second = scene.elements.find((element) => element.id === 'edge_api-worker');
  for (const routed of [first, second]) {
    const points = absolutePoints(routed);
    assert.equal(routed.customData.excalidrawSkill.route.sourceSide, 'down');
    assert.equal(routed.customData.excalidrawSkill.route.targetSide, 'up');
    assert.equal(routed.customData.excalidrawSkill.route.axisLock, 'vertical');
    assert.equal(points[0].x, points.at(-1).x);
  }
});

test('layered-flow keeps primary path together and support away from it', () => {
  const nodes = [
    { semanticId: 'a', layoutHints: { rank: 0, importance: 'primary' } },
    { semanticId: 'b', layoutHints: { rank: 1, importance: 'primary' } },
    { semanticId: 'db', layoutHints: { lane: 'bottom', rank: 1, importance: 'support' } }
  ];
  const spec = {
    diagramType: 'service-flow',
    version: '2.0',
    nodes,
    edges: [],
    layout: {
      profile: 'layered-flow',
      primaryFlow: ['a', 'b'],
      lanes: [{ id: 'bottom', position: 'bottom' }]
    }
  };
  const placed = positions(layoutServiceFlow(sceneFor(nodes), spec));
  assert.ok(placed.get('a').x < placed.get('b').x);
  assert.equal(placed.get('a').y, placed.get('b').y);
  assert.ok(placed.get('db').y > placed.get('b').y);
});

test('hub-and-spoke puts external and support nodes on separate sides', () => {
  const nodes = [
    { semanticId: 'hub', shapeRef: 'service.backend', layoutHints: { importance: 'primary' } },
    { semanticId: 'caller', shapeRef: 'service.backend' },
    { semanticId: 'provider', shapeRef: 'external.system' },
    { semanticId: 'db', shapeRef: 'database.relational', layoutHints: { importance: 'support' } }
  ];
  const spec = {
    diagramType: 'service-flow',
    version: '2.0',
    nodes,
    edges: [
      { from: 'caller', to: 'hub' },
      { from: 'hub', to: 'provider' },
      { from: 'hub', to: 'db' }
    ],
    layout: { profile: 'hub-and-spoke', primaryFlow: ['hub'] }
  };
  const placed = positions(layoutServiceFlow(sceneFor(nodes), spec));
  assert.ok(placed.get('caller').x < placed.get('hub').x);
  assert.ok(placed.get('provider').x > placed.get('hub').x);
  assert.ok(placed.get('db').y > placed.get('hub').y);
});

for (const diagramType of ['flow', 'event-flow', 'data-flow']) {
  test(`${diagramType} uses the flow layout engine`, () => {
    const nodes = [
      { semanticId: 'source', layoutHints: { rank: 0, importance: 'primary' } },
      { semanticId: 'sink', layoutHints: { rank: 1, importance: 'primary' } }
    ];
    const spec = {
      version: '2.0',
      diagramType,
      nodes,
      edges: [],
      layout: { profile: 'layered-flow', primaryFlow: ['source', 'sink'] }
    };
    const scene = layoutServiceFlow(sceneFor(nodes), spec);
    const placed = positions(scene);
    assert.ok(placed.get('source').x < placed.get('sink').x);
    assert.equal(scene.customData.excalidrawSkill.layout.family, 'flow');
    assert.equal(scene.customData.excalidrawSkill.layout.subtype, diagramType);
  });
}

test('non-flow scenes are unchanged', () => {
  const nodes = [{ semanticId: 'a' }];
  const scene = sceneFor(nodes);
  const before = JSON.stringify(scene);
  layoutServiceFlow(scene, { diagramType: 'system-architecture', nodes, edges: [] });
  assert.equal(JSON.stringify(scene), before);
});

test('v1 service-flow scenes remain unchanged', () => {
  const nodes = [{ semanticId: 'a' }, { semanticId: 'b' }];
  const scene = sceneFor(nodes);
  const before = JSON.stringify(scene);
  layoutServiceFlow(scene, { version: '1.0', diagramType: 'service-flow', nodes, edges: [] });
  assert.equal(JSON.stringify(scene), before);
});
