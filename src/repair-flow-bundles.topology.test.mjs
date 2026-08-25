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

test('repairs fan-out before fan-in so branch nodes do not reuse the same endpoint corridor', () => {
  const request = node('request', 0, 232);
  const router = node('router', 300, 232);
  const aggregate = node('aggregate', 1020, 232, 180, 96);
  const response = node('response', 1320, 240);
  const policy = node('policy', 720, 342);
  const quota = node('quota', 720, 576);
  const risk = node('risk', 720, 690);

  const scene = {
    elements: [
      request,
      router,
      aggregate,
      response,
      policy,
      quota,
      risk,
      edge('request-router', 'request', 'router', [
        { x: 180, y: 272 }, { x: 300, y: 272 }
      ]),
      edge('router-policy', 'router', 'policy', [
        { x: 390, y: 312 }, { x: 390, y: 330 }, { x: 940, y: 330 }, { x: 940, y: 382 }, { x: 900, y: 382 }
      ]),
      edge('router-quota', 'router', 'quota', [
        { x: 374, y: 312 }, { x: 374, y: 350 }, { x: 960, y: 350 }, { x: 960, y: 616 }, { x: 900, y: 616 }
      ]),
      edge('router-risk', 'router', 'risk', [
        { x: 406, y: 312 }, { x: 406, y: 370 }, { x: 980, y: 370 }, { x: 980, y: 730 }, { x: 900, y: 730 }
      ]),
      edge('policy-aggregate', 'policy', 'aggregate', [
        { x: 818, y: 342 }, { x: 818, y: 335 }, { x: 1094, y: 335 }, { x: 1094, y: 328 }
      ]),
      edge('quota-aggregate', 'quota', 'aggregate', [
        { x: 810, y: 576 }, { x: 810, y: 452 }, { x: 1110, y: 452 }, { x: 1110, y: 328 }
      ]),
      edge('risk-aggregate', 'risk', 'aggregate', [
        { x: 810, y: 690 }, { x: 810, y: 670 }, { x: 1126, y: 670 }, { x: 1126, y: 348 }, { x: 1126, y: 328 }
      ]),
      edge('aggregate-response', 'aggregate', 'response', [
        { x: 1200, y: 280 }, { x: 1320, y: 280 }
      ])
    ]
  };

  const spec = {
    diagramType: 'service-flow',
    layout: {
      profile: 'swimlane-flow',
      direction: 'left-to-right',
      primaryFlow: ['request', 'router', 'aggregate', 'response']
    },
    nodes: [
      { semanticId: 'request', layoutHints: { lane: 'main', rank: 0, importance: 'primary' } },
      { semanticId: 'router', layoutHints: { lane: 'main', rank: 1, importance: 'primary' } },
      { semanticId: 'policy', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'quota', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'risk', layoutHints: { lane: 'branch', rank: 2 } },
      { semanticId: 'aggregate', layoutHints: { lane: 'main', rank: 3, importance: 'primary' } },
      { semanticId: 'response', layoutHints: { lane: 'main', rank: 4, importance: 'primary' } }
    ],
    edges: [
      { semanticId: 'request-router', from: 'request', to: 'router', routeHints: { priority: 'primary' } },
      { semanticId: 'router-policy', from: 'router', to: 'policy', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'router-quota', from: 'router', to: 'quota', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'router-risk', from: 'router', to: 'risk', routeHints: { direction: 'down', priority: 'secondary' } },
      { semanticId: 'policy-aggregate', from: 'policy', to: 'aggregate', routeHints: { direction: 'up', priority: 'secondary' } },
      { semanticId: 'quota-aggregate', from: 'quota', to: 'aggregate', routeHints: { direction: 'up', priority: 'secondary' } },
      { semanticId: 'risk-aggregate', from: 'risk', to: 'aggregate', routeHints: { direction: 'up', priority: 'secondary' } },
      { semanticId: 'aggregate-response', from: 'aggregate', to: 'response', routeHints: { priority: 'primary' } }
    ]
  };

  const result = repairFlowBundles(scene, spec);
  const repair = result.customData.excalidrawSkill.flowBundleRepair;
  const fanOut = repair.decisions.find((item) => item.kind === 'fan-out');
  const fanIn = repair.decisions.find((item) => item.kind === 'fan-in');
  const quality = createQualityReport(result, spec);

  assert.equal(repair.decisions[0].kind, 'fan-out');
  assert.equal(fanOut.accepted, true, JSON.stringify(fanOut));
  assert.equal(fanIn.accepted, true, JSON.stringify(fanIn));
  assert.equal(fanIn.hardPenaltyAfter, 0, JSON.stringify(fanIn));
  assert.equal(quality.metrics.endpointOverlaps, 0, JSON.stringify(quality.details.endpointOverlaps));
  assert.equal(quality.metrics.endpointApproachViolations, 0, JSON.stringify(quality.details.endpointApproachViolations));
});
