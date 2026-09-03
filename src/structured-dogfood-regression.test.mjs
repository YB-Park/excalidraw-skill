import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyLayoutStrategy } from './layout-strategies.mjs';
import { layoutServiceFlow } from './layout-service-flow.mjs';
import { createFamilyQualityReport } from './family-quality.mjs';

const fixtures = [
  '../examples/dogfood/copilot-cloud-001/payment-approval.diagram.json',
  '../examples/dogfood/copilot-cloud-001/order-fulfillment.diagram.json',
  '../examples/dogfood/copilot-cloud-001/observability-pipeline.diagram.json'
];

function read(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

function sceneFor(spec) {
  return {
    type: 'excalidraw',
    version: 2,
    elements: (spec.nodes ?? []).map((node, index) => ({
      id: `node-${index}`,
      type: 'rectangle',
      x: index * 20,
      y: 0,
      width: 180,
      height: 80,
      customData: {
        excalidrawSkill: {
          role: 'node',
          semanticId: node.semanticId
        }
      }
    }))
  };
}

test('Structured strategy keeps all three real dogfood sequential flows in primary-flow order', () => {
  for (const fixture of fixtures) {
    const original = read(fixture);
    const structured = applyLayoutStrategy(original, 'structured');
    assert.equal(structured.layout.profile, 'layered-flow', fixture);

    const scene = layoutServiceFlow(sceneFor(structured), structured);
    const report = createFamilyQualityReport(scene, structured);
    assert.equal(report.metrics.primaryFlowMissing, 0, fixture);
    assert.equal(report.metrics.primaryFlowOrderViolations, 0, fixture);
  }
});
