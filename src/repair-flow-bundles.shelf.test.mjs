import test from 'node:test';
import assert from 'node:assert/strict';
import { repairFlowBundles } from './repair-flow-bundles.mjs';
import { createQualityReport } from './quality-report.mjs';

function node(id, x, y, width = 180, height = 80) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x,
    y,
    width,
    height,
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
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } }
  };
}

test('uses direct, bypass, and lateral channels for a mixed support shelf', () => {
  const hub = node('hub', 300, 0);
  const card = node('card', 600, 0);
  const fraud = node('fraud', 300, 180);
  const db = node('db', 300, 340);
  const events = node('events', 600, 260);

  const scene = {
    elements: [
      hub,
      card,
      fraud,
      db,
      events,
      edge('hub-card', 'hub', 'card', [
        { x: 480, y: 40 }, { x: 600, y: 40 }
      ]),
      edge('hub-fraud', 'hub', 'fraud', [
        { x: 390, y: 80 }, { x: 390, y: 180 }
      ]),
      edge('hub-db', 'hub', 'db', [
        { x: 370, y: 80 }, { x: 370, y: 120 }, { x: 250, y: 120 }, { x: 250, y: 380 }, { x: 300, y: 380 }
      ]),
      edge('hub-events', 'hub', 'events', [
        { x: 410, y: 80 }, { x: 410, y: 120 }, { x: 820, y: 120 }, { x: 820, y: 300 }, { x: 780, y: 300 }
      ])
    ]
  };

  const spec = {
    diagramType: 'service-flow',
    layout: {
      profile: 'swimlane-flow',
      direction: 'left-to-right',
      primaryFlow: ['hub', 'card']
    },
    nodes: [
      { semanticId: 'hub', layoutHints: { lane: 'main', rank: 1, importance: 'primary' } },
      { semanticId: 'card', layoutHints: { lane: 'main', rank: 2, importance: 'primary' } },
      { semanticId: 'fraud', layoutHints: { lane: 'support', rank: 1, importance: 'secondary' } },
      { semanticId: 'db', layoutHints: { lane: 'support', rank: 1, importance: 'secondary' } },
      { semanticId: 'events', layoutHints: { lane: 'support', rank: 2, importance: 'support' } }
    ],
    edges: [
      { semanticId: 'hub-card', from: 'hub', to: 'card', routeHints: { priority: 'primary' } },
      { semanticId: 'hub-fraud', from: 'hub', to: 'fraud', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'hub-db', from: 'hub', to: 'db', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'hub-events', from: 'hub', to: 'events', routeHints: { direction: 'down', priority: 'secondary' } }
    ]
  };

  const result = repairFlowBundles(scene, spec);
  const repair = result.customData.excalidrawSkill.flowBundleRepair;
  const decision = repair.decisions.find((item) => item.kind === 'fan-out');
  const byId = new Map(result.elements
    .filter((item) => item.customData?.excalidrawSkill?.role === 'edge')
    .map((item) => [item.customData.excalidrawSkill.semanticId, item]));
  const quality = createQualityReport(result, spec);

  assert.equal(decision.accepted, true, JSON.stringify(decision));
  assert.equal(decision.hardPenaltyAfter, 0, JSON.stringify(decision));
  assert.equal(byId.get('hub-fraud').customData.excalidrawSkill.route.bends, 0);
  assert.equal(byId.get('hub-fraud').customData.excalidrawSkill.flowBundleRepair.template, 'support-shelf-direct');
  assert.equal(byId.get('hub-db').customData.excalidrawSkill.route.bends, 2);
  assert.equal(byId.get('hub-db').customData.excalidrawSkill.flowBundleRepair.template, 'support-shelf-centered-bypass');
  assert.equal(byId.get('hub-events').customData.excalidrawSkill.route.bends, 2);
  assert.equal(byId.get('hub-events').customData.excalidrawSkill.flowBundleRepair.template, 'support-shelf-lateral-channel');
  assert.equal(quality.metrics.nodeOverlaps, 0);
  assert.equal(quality.metrics.edgeNodeCrossings, 0);
  assert.equal(quality.metrics.endpointOverlaps, 0);
  assert.equal(quality.metrics.endpointApproachViolations, 0);
});
