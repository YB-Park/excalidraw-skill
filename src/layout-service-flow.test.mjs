import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutServiceFlow } from './layout-service-flow.mjs';

function sceneFor(nodes) {
  const elements = [];
  nodes.forEach((node, index) => {
    elements.push({
      id: `node_${node.semanticId}`,
      type: 'rectangle',
      x: 100 + index * 260,
      y: 120,
      width: 180,
      height: 80,
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

function positions(scene) {
  return new Map(scene.elements
    .filter((element) => element.customData?.excalidrawSkill?.role === 'node')
    .map((element) => [element.customData.excalidrawSkill.semanticId, { x: element.x, y: element.y }]));
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
