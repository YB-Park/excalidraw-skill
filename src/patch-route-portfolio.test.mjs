import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { improvePatchRoutes } from './patch-route-portfolio.mjs';
import { createQualityReport } from './quality-report.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';

function meta(element) {
  return element.customData?.excalidrawSkill ?? {};
}

function node(scene, semanticId) {
  return scene.elements.find((element) => meta(element).role === 'node' && meta(element).semanticId === semanticId);
}

function edge(scene, semanticId) {
  return scene.elements.find((element) => meta(element).role === 'edge' && meta(element).semanticId === semanticId);
}

function moveNode(scene, semanticId, x, y) {
  const target = node(scene, semanticId);
  const label = scene.elements.find((element) => meta(element).role === 'label' && meta(element).node === semanticId);
  const dx = x - target.x;
  const dy = y - target.y;
  target.x = x;
  target.y = y;
  if (label) {
    label.x += dx;
    label.y += dy;
  }
}

function setRoute(target, points, sourceSide, targetSide) {
  target.x = points[0].x;
  target.y = points[0].y;
  target.points = points.map((point) => [point.x - target.x, point.y - target.y]);
  const last = target.points.at(-1);
  target.width = last[0];
  target.height = last[1];
  meta(target).route = {
    engine: 'fixture',
    sourceSide,
    targetSide,
    axisLock: null,
    bends: Math.max(0, points.length - 2)
  };
}

function routeCost(scene) {
  const report = createPerceptualQuality(scene, null);
  return report.metrics.readabilityCost - report.metrics.edgeLabelAssociationCost;
}

test('replaces a hard-safe three-bend patch route with a shorter local route', () => {
  const scene = renderSpec({
    diagramType: 'service-flow',
    stylePreset: 'professional-software',
    nodes: [
      { semanticId: 'source', label: 'Source', shapeRef: 'service.backend' },
      { semanticId: 'target', label: 'Target', shapeRef: 'database.relational' }
    ],
    edges: [
      { semanticId: 'source-target', from: 'source', to: 'target', label: 'audit', kind: 'writes' }
    ]
  });
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layout = { family: 'flow', subtype: 'service-flow' };
  moveNode(scene, 'source', 100, 100);
  moveNode(scene, 'target', 400, 400);

  const targetEdge = edge(scene, 'source-target');
  setRoute(targetEdge, [
    { x: 190, y: 180 },
    { x: 190, y: 220 },
    { x: 620, y: 220 },
    { x: 620, y: 440 },
    { x: 580, y: 440 }
  ], 'down', 'right');

  const beforeCost = routeCost(scene);
  const result = improvePatchRoutes(scene, new Set(['source-target']));
  const after = edge(scene, 'source-target');
  const afterCost = routeCost(scene);

  assert.equal(result.considered, 1);
  assert.equal(result.changed, 1);
  assert.equal(result.decisions[0].accepted, true);
  assert.ok(meta(after).route.bends <= 2);
  assert.ok(afterCost + 0.5 <= beforeCost);
  assert.equal(createQualityReport(scene).structuralPass, true);
});

test('is a no-op outside flow scenes', () => {
  const scene = renderSpec({
    diagramType: 'system-architecture',
    nodes: [
      { semanticId: 'a', label: 'A', shapeRef: 'service.backend' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b', label: 'call', kind: 'calls' }]
  });
  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layout = { family: 'system-architecture' };
  const before = structuredClone(edge(scene, 'a-b').points);
  const result = improvePatchRoutes(scene, new Set(['a-b']));
  assert.equal(result.considered, 0);
  assert.equal(result.changed, 0);
  assert.deepEqual(edge(scene, 'a-b').points, before);
});
