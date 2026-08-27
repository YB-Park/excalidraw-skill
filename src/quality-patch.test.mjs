import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { applyQualityPatch } from './quality-patch.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { createQualityReport } from './quality-report.mjs';

function meta(element) {
  return element.customData?.excalidrawSkill ?? {};
}

function baseScene(nodes = [
  { semanticId: 'a', label: 'A', shapeRef: 'client.web' },
  { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
], edges = [
  { semanticId: 'a-b', from: 'a', to: 'b', label: 'call', kind: 'calls' }
]) {
  return renderSpec({
    diagramType: 'service-flow',
    stylePreset: 'professional-software',
    nodes,
    edges
  });
}

function edge(scene, semanticId) {
  return scene.elements.find((element) => meta(element).role === 'edge' && meta(element).semanticId === semanticId);
}

function edgeLabel(scene, semanticId) {
  return scene.elements.find((element) => meta(element).role === 'edge-label' && meta(element).edge === semanticId);
}

function node(scene, semanticId) {
  return scene.elements.find((element) => meta(element).role === 'node' && meta(element).semanticId === semanticId);
}

function geometry(element) {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    points: structuredClone(element.points ?? [])
  };
}

function assertOrthogonal(route) {
  const points = route.points ?? [];
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    assert.ok(ax === bx || ay === by, `segment ${index - 1} is not orthogonal`);
  }
}

function assertHardGates(scene) {
  const editability = createEditabilityReport(scene);
  const quality = createQualityReport(scene);
  assert.equal(editability.pass, true, JSON.stringify(editability));
  assert.equal(quality.structuralPass, true, JSON.stringify(quality));
}

test('addNode/addEdge round trip gets native binding, kind style, label, and orthogonal routing', () => {
  const scene = applyQualityPatch(baseScene(), {
    operations: [
      { op: 'addNode', semanticId: 'store', label: 'Order Store', shapeRef: 'database.relational', near: 'b', side: 'down', gap: 80 },
      { op: 'addEdge', semanticId: 'b-store', from: 'b', to: 'store', label: 'persist', kind: 'writes' }
    ]
  });

  const addedEdge = edge(scene, 'b-store');
  assert.ok(addedEdge);
  assertOrthogonal(addedEdge);
  assert.equal(meta(addedEdge).styleRole, 'data-write');
  assert.ok(edgeLabel(scene, 'b-store'));
  assert.equal(meta(addedEdge).route?.engine, 'graph-aware-v0.3.5');
  assertHardGates(scene);
});

test('moveNear reroutes connected edges but preserves unrelated edge geometry', () => {
  const scene = baseScene(
    [
      { semanticId: 'a', label: 'A', shapeRef: 'client.web' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' },
      { semanticId: 'c', label: 'C', shapeRef: 'service.backend' },
      { semanticId: 'd', label: 'D', shapeRef: 'database.relational' }
    ],
    [
      { semanticId: 'a-b', from: 'a', to: 'b', label: 'call', kind: 'calls' },
      { semanticId: 'c-d', from: 'c', to: 'd', label: 'write', kind: 'writes' }
    ]
  );
  const unrelatedBefore = geometry(edge(scene, 'c-d'));
  const cBefore = { x: node(scene, 'c').x, y: node(scene, 'c').y };
  const dBefore = { x: node(scene, 'd').x, y: node(scene, 'd').y };

  applyQualityPatch(scene, {
    preserveManualLayout: true,
    operations: [{ op: 'moveNear', target: 'b', near: 'a', side: 'down', gap: 80 }]
  });

  assertOrthogonal(edge(scene, 'a-b'));
  assert.deepEqual(geometry(edge(scene, 'c-d')), unrelatedBefore);
  assert.deepEqual({ x: node(scene, 'c').x, y: node(scene, 'c').y }, cBefore);
  assert.deepEqual({ x: node(scene, 'd').x, y: node(scene, 'd').y }, dBefore);
  assertHardGates(scene);
});

test('insertNodeBetween creates two quality-gated labeled orthogonal edges', () => {
  const scene = applyQualityPatch(baseScene(), {
    operations: [{
      op: 'insertNodeBetween',
      target: 'a-b',
      semanticId: 'gateway',
      label: 'API Gateway',
      shapeRef: 'gateway.api',
      inLabel: 'request',
      outLabel: 'forward'
    }]
  });

  assert.equal(edge(scene, 'a-b'), undefined);
  const incoming = edge(scene, 'a-b__in');
  const outgoing = edge(scene, 'a-b__out');
  assert.ok(incoming && outgoing);
  assertOrthogonal(incoming);
  assertOrthogonal(outgoing);
  assert.ok(edgeLabel(scene, 'a-b__in'));
  assert.ok(edgeLabel(scene, 'a-b__out'));
  assertHardGates(scene);
});

test('updateLabel resizes locally and refreshes connected edge geometry', () => {
  const scene = baseScene();
  const before = geometry(edge(scene, 'a-b'));
  applyQualityPatch(scene, {
    operations: [{ op: 'updateLabel', target: 'b', label: 'Backend Service With Longer Name' }]
  });
  const after = geometry(edge(scene, 'a-b'));
  assert.notDeepEqual(after, before);
  assertOrthogonal(edge(scene, 'a-b'));
  assertHardGates(scene);
});
