import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutServiceFlow } from './layout-service-flow.mjs';
import { refineFlowPrimarySpine } from './refine-flow-primary-spine.mjs';
import { routeEdges } from './route-edges.mjs';
import { absolutePoints } from './geometry.mjs';

function nodeElement(id, index, width, height) {
  return {
    id: `node_${id}`,
    type: 'rectangle',
    x: 100 + index * 260,
    y: 120,
    width,
    height,
    customData: { excalidrawSkill: { role: 'node', semanticId: id } }
  };
}

function labelElement(id, index) {
  return {
    id: `label_${id}`,
    type: 'text',
    x: 116 + index * 260,
    y: 146,
    width: 120,
    height: 28,
    customData: { excalidrawSkill: { role: 'label', node: id } }
  };
}

function edgeElement(id, from, to) {
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [[0, 0], [0, 0]],
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to, kind: 'transfers' } }
  };
}

function centerY(node) {
  return node.y + node.height / 2;
}

test('center-aligns mixed-height layered primary nodes so horizontal primary edges stay straight', () => {
  const ids = ['source', 'queue', 'store', 'sink'];
  const dimensions = [
    [180, 80],
    [180, 96],
    [200, 112],
    [180, 80]
  ];
  const nodes = ids.map((id, index) => ({
    semanticId: id,
    layoutHints: { rank: index, importance: 'primary' }
  }));
  const edges = ids.slice(0, -1).map((id, index) => ({
    semanticId: `${id}-${ids[index + 1]}`,
    from: id,
    to: ids[index + 1],
    routeHints: { priority: 'primary' }
  }));
  const spec = {
    version: '2.0',
    diagramType: 'data-flow',
    nodes,
    edges,
    layout: {
      profile: 'layered-flow',
      direction: 'left-to-right',
      primaryFlow: ids
    }
  };
  const scene = {
    type: 'excalidraw',
    elements: [
      ...ids.flatMap((id, index) => [
        nodeElement(id, index, ...dimensions[index]),
        labelElement(id, index)
      ]),
      ...edges.map((edge) => edgeElement(edge.semanticId, edge.from, edge.to))
    ]
  };

  layoutServiceFlow(scene, spec);
  const beforeCenters = ids.map((id) => centerY(scene.elements.find((element) => element.id === `node_${id}`)));
  assert.ok(new Set(beforeCenters).size > 1);

  refineFlowPrimarySpine(scene, spec);
  routeEdges(scene, spec);

  const afterCenters = ids.map((id) => centerY(scene.elements.find((element) => element.id === `node_${id}`)));
  assert.equal(new Set(afterCenters).size, 1);
  for (const edge of edges) {
    const routed = scene.elements.find((element) => element.id === `edge_${edge.semanticId}`);
    const points = absolutePoints(routed);
    assert.equal(routed.customData.excalidrawSkill.route.bends, 0, edge.semanticId);
    assert.equal(points[0].y, points.at(-1).y, edge.semanticId);
  }
  const refinement = scene.customData.excalidrawSkill.primarySpineRefinement;
  assert.equal(refinement.strategy, 'median-center-alignment');
  assert.ok(refinement.moved >= 1);
});

test('is a no-op for swimlane flow because lane layout already owns the spine', () => {
  const scene = {
    type: 'excalidraw',
    elements: [nodeElement('a', 0, 180, 80), nodeElement('b', 1, 180, 96)]
  };
  const before = JSON.stringify(scene);
  refineFlowPrimarySpine(scene, {
    diagramType: 'service-flow',
    layout: { profile: 'swimlane-flow', primaryFlow: ['a', 'b'] }
  });
  assert.equal(JSON.stringify(scene), before);
});
