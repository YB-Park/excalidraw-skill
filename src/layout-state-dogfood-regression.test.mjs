import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyLayoutState } from './layout-state.mjs';
import { createQualityReport } from './quality-report.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const meta = (element) => element?.customData?.excalidrawSkill ?? {};

function reconstructPreApplyScene(stalePostApplyScene, moves) {
  const scene = structuredClone(stalePostApplyScene);
  const byId = new Map((scene.elements ?? []).map((element) => [element.id, element]));
  for (const move of moves) {
    const node = (scene.elements ?? []).find((element) => meta(element).role === 'node' && meta(element).semanticId === move.semanticId);
    assert.ok(node, `missing dogfood node ${move.semanticId}`);
    node.x -= move.dx;
    node.y -= move.dy;
    for (const bound of node.boundElements ?? []) {
      const child = byId.get(bound.id);
      if (child?.type === 'text') {
        child.x -= move.dx;
        child.y -= move.dy;
      }
    }
  }
  return scene;
}

test('dogfood #002 stale LayoutState endpoints are reconciled after reapply', () => {
  const stalePostApply = read('../examples/dogfood/copilot-cloud-002/regenerated.excalidraw');
  const layoutState = read('../examples/dogfood/copilot-cloud-002/captured-layout-state.json');
  const moveLog = read('../examples/dogfood/copilot-cloud-002/layout-reapply.log');
  const spec = read('../examples/dogfood/copilot-cloud-002/changed.diagram.json');
  const oldQuality = read('../examples/dogfood/copilot-cloud-002/regenerated.quality.json');
  const preApply = reconstructPreApplyScene(stalePostApply, moveLog.moves);

  const result = applyLayoutState(preApply, layoutState);
  const quality = createQualityReport(result.scene, spec);
  const payment = result.scene.elements.find((element) => meta(element).semanticId === 'payment-service');
  const events = result.scene.elements.find((element) => meta(element).semanticId === 'payment-events');

  assert.deepEqual([payment.x, payment.y], [680, 190]);
  assert.deepEqual([events.x, events.y], [1060, 545]);
  assert.equal(payment.customData.excalidrawSkill.manualLayout, true);
  assert.equal(events.customData.excalidrawSkill.manualLayout, true);
  assert.ok(result.reconciledEdges.length >= 5, 'all edges incident to moved nodes should be reconsidered');

  assert.ok(oldQuality.metrics.endpointApproachViolations > 0, 'fixture must preserve the original dogfood failure');
  assert.ok(oldQuality.metrics.endpointNodePenetrations > 0, 'fixture must preserve the original penetration failure');
  assert.equal(quality.metrics.endpointApproachViolations, 0);
  assert.equal(quality.metrics.endpointNodePenetrations, 0);
  assert.equal(quality.metrics.edgeNodeCrossings, 0);
  assert.ok(quality.metrics.labelNodeOverlaps <= oldQuality.metrics.labelNodeOverlaps);
  assert.equal(result.requiresFreshReview, true);
});
