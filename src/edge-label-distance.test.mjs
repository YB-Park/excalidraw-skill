import test from 'node:test';
import assert from 'node:assert/strict';
import { placeEdgeLabels } from './place-edge-labels.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';
import { rectToSegmentsDistance, segmentsFromEdge } from './geometry.mjs';

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

function edge(id, from, to, x, y, points) {
  const last = points.at(-1);
  return {
    id: `edge_${id}`,
    type: 'arrow',
    x,
    y,
    width: last[0],
    height: last[1],
    points,
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } }
  };
}

function label(edgeId, width = 112, height = 22) {
  return {
    id: `label_${edgeId}`,
    type: 'text',
    x: 0,
    y: 0,
    width,
    height,
    customData: { excalidrawSkill: { role: 'edge-label', edge: edgeId } }
  };
}

test('measures a wide vertical edge label by visible box gap rather than label-center distance', () => {
  const a = node('a', 100, 0);
  const b = node('b', 100, 300);
  const e = edge('a-b', 'a', 'b', 190, 80, [[0, 0], [0, 220]]);
  const l = label('a-b', 112, 22);
  const scene = { elements: [a, b, e, l] };

  placeEdgeLabels(scene, { edges: [{ semanticId: 'a-b', routeHints: { labelSide: 'right' } }] });
  const report = createPerceptualQuality(scene);
  const placement = l.customData.excalidrawSkill.placement;
  const detail = report.details.edgeLabels[0];

  assert.equal(placement.distanceModel, 'label-box-to-edge');
  assert.ok(placement.ownDistance >= 13 && placement.ownDistance <= 15, JSON.stringify(placement));
  assert.equal(detail.ownDistance, placement.ownDistance);
  assert.equal(report.metrics.distantEdgeLabels, 0);
  assert.equal(report.details.edgeLabelDistanceModel, 'label-box-to-edge');
});

test('segment-to-label distance is zero when the edge crosses the label rectangle', () => {
  const e = edge('crossing', 'a', 'b', 0, 50, [[0, 0], [200, 0]]);
  const rect = { x: 80, y: 40, width: 60, height: 20 };
  assert.equal(rectToSegmentsDistance(rect, segmentsFromEdge(e)), 0);
});

test('box-distance association still flags a label that sits on another edge', () => {
  const top = edge('top', 'a', 'b', 0, 100, [[0, 0], [400, 0]]);
  const bottom = edge('bottom', 'c', 'd', 0, 180, [[0, 0], [400, 0]]);
  const misplaced = {
    id: 'label_top',
    type: 'text',
    x: 160,
    y: 170,
    width: 80,
    height: 20,
    customData: { excalidrawSkill: { role: 'edge-label', edge: 'top' } }
  };

  const report = createPerceptualQuality({ elements: [top, bottom, misplaced] });
  const detail = report.details.edgeLabels[0];

  assert.equal(report.metrics.ambiguousEdgeLabels, 1);
  assert.equal(detail.nearestOtherEdge, 'bottom');
  assert.equal(detail.nearestOtherDistance, 0);
  assert.ok(detail.ownDistance > 0);
});
