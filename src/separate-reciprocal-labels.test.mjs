import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerceptualQuality } from './perceptual-quality.mjs';
import { placeEdgeLabels } from './place-edge-labels.mjs';
import { reciprocalLabelSides, separateReciprocalLabels } from './separate-reciprocal-labels.mjs';

function node(id, x, y) {
  return { id: `node_${id}`, type: 'rectangle', x, y, width: 180, height: 80, customData: { excalidrawSkill: { role: 'node', semanticId: id } } };
}

function edge(id, from, to, x, y, points) {
  const last = points.at(-1);
  return { id: `edge_${id}`, type: 'arrow', x, y, width: last[0], height: last[1], points, customData: { excalidrawSkill: { role: 'edge', semanticId: id, from, to } } };
}

function label(edgeId, width = 74) {
  return { id: `label_${edgeId}`, type: 'text', x: 0, y: 0, width, height: 22, text: edgeId, customData: { excalidrawSkill: { role: 'edge-label', edge: edgeId } } };
}

test('assigns opposite sides to reciprocal vertical relations', () => {
  const down = edge('consumer-retry', 'consumer', 'retry', 180, 80, [[0, 0], [0, 220]]);
  const up = edge('retry-consumer', 'retry', 'consumer', 200, 300, [[0, 0], [0, -220]]);
  const sides = reciprocalLabelSides({ elements: [down, up] });
  assert.equal(sides.get('consumer-retry'), 'left');
  assert.equal(sides.get('retry-consumer'), 'right');
});

test('repositions reciprocal labels so each stays associated with its own edge', () => {
  const consumer = node('consumer', 90, 0);
  const retry = node('retry', 90, 300);
  const down = edge('consumer-retry', 'consumer', 'retry', 180, 80, [[0, 0], [0, 220]]);
  const up = edge('retry-consumer', 'retry', 'consumer', 200, 300, [[0, 0], [0, -220]]);
  const downLabel = label('consumer-retry', 90);
  const upLabel = label('retry-consumer', 48);
  const scene = { elements: [consumer, retry, down, up, downLabel, upLabel] };
  const spec = { edges: [
    { semanticId: 'consumer-retry', from: 'consumer', to: 'retry' },
    { semanticId: 'retry-consumer', from: 'retry', to: 'consumer' }
  ] };

  placeEdgeLabels(scene, spec);
  separateReciprocalLabels(scene, spec);
  const report = createPerceptualQuality(scene, spec);

  assert.equal(downLabel.customData.excalidrawSkill.placement.side, 'left');
  assert.equal(upLabel.customData.excalidrawSkill.placement.side, 'right');
  assert.equal(report.metrics.ambiguousEdgeLabels, 0);
});
