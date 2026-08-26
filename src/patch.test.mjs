import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { applyPatch } from './patch.mjs';
import { inspectScene } from './inspect-scene.mjs';

function baseScene() {
  return renderSpec({
    diagramType: 'service-flow',
    stylePreset: 'professional-software',
    nodes: [
      { semanticId: 'a', label: 'A', shapeRef: 'client.web' },
      { semanticId: 'b', label: 'B', shapeRef: 'service.backend' }
    ],
    edges: [{ semanticId: 'a-b', from: 'a', to: 'b', label: 'call', kind: 'calls' }]
  });
}

function meta(element) {
  return element.customData?.excalidrawSkill ?? {};
}

test('addNode and addEdge preserve native bindings', () => {
  const scene = applyPatch(baseScene(), {
    operations: [
      { op: 'addNode', semanticId: 'c', label: 'C', shapeRef: 'database.relational', near: 'b', side: 'down' },
      { op: 'addEdge', semanticId: 'b-c', from: 'b', to: 'c', kind: 'writes' }
    ]
  });
  const summary = inspectScene(scene);
  assert.ok(summary.nodes.some((node) => node.semanticId === 'c'));
  assert.ok(summary.edges.some((edge) => edge.semanticId === 'b-c'));
  assert.deepEqual(summary.warnings, []);
});

test('updateLabel and moveNear make a local edit without moving unrelated nodes', () => {
  const scene = baseScene();
  const a = scene.elements.find((element) => meta(element).semanticId === 'a');
  const b = scene.elements.find((element) => meta(element).semanticId === 'b');
  const aBefore = { x: a.x, y: a.y };

  applyPatch(scene, {
    preserveManualLayout: true,
    operations: [
      { op: 'updateLabel', target: 'b', label: 'Backend Service' },
      { op: 'moveNear', target: 'b', near: 'a', side: 'down', gap: 60 }
    ]
  });

  assert.deepEqual({ x: a.x, y: a.y }, aBefore);
  assert.equal(meta(b).label, 'Backend Service');
  assert.equal(meta(b).manualLayout, true);
  assert.ok(b.y > a.y);
  assert.deepEqual(inspectScene(scene).warnings, []);
});

test('insertNodeBetween replaces one semantic edge with two bound edges', () => {
  const scene = applyPatch(baseScene(), {
    operations: [{
      op: 'insertNodeBetween',
      target: 'a-b',
      semanticId: 'gateway',
      label: 'Gateway',
      shapeRef: 'gateway.api'
    }]
  });
  const summary = inspectScene(scene);

  assert.ok(summary.nodes.some((node) => node.semanticId === 'gateway'));
  assert.ok(!summary.edges.some((edge) => edge.semanticId === 'a-b'));
  assert.ok(summary.edges.some((edge) => edge.from === 'a' && edge.to === 'gateway'));
  assert.ok(summary.edges.some((edge) => edge.from === 'gateway' && edge.to === 'b'));
  assert.deepEqual(summary.warnings, []);
});

test('groupIntoFrame sets native frame membership', () => {
  const scene = applyPatch(baseScene(), {
    operations: [{
      op: 'groupIntoFrame',
      semanticId: 'internal',
      label: 'Internal',
      members: ['a', 'b'],
      boundaryIntent: 'ownership-boundary'
    }]
  });
  const frame = scene.elements.find((element) => meta(element).role === 'frame');
  const nodes = scene.elements.filter((element) => meta(element).role === 'node');
  const labels = scene.elements.filter((element) => meta(element).role === 'label');

  assert.ok(frame);
  assert.ok(nodes.every((node) => node.frameId === frame.id));
  assert.ok(labels.every((label) => label.frameId === frame.id));
  assert.equal(inspectScene(scene).frames[0].boundaryIntent, 'ownership-boundary');
});

test('applyStylePreset and removeObject are implemented operations', () => {
  const scene = baseScene();
  const service = scene.elements.find((element) => meta(element).semanticId === 'b');
  applyPatch(scene, {
    operations: [
      { op: 'applyStylePreset', preset: 'professional-software' },
      { op: 'removeObject', target: 'a' }
    ]
  });

  assert.equal(service.strokeColor, '#4f46e5');
  const summary = inspectScene(scene);
  assert.ok(!summary.nodes.some((node) => node.semanticId === 'a'));
  assert.equal(summary.edges.length, 0);
});

test('applyStylePreset styles patch-added edges through the shared preset resolver', () => {
  const scene = applyPatch(baseScene(), {
    operations: [
      { op: 'addNode', semanticId: 'c', label: 'C', shapeRef: 'database.relational', near: 'b', side: 'down' },
      { op: 'addEdge', semanticId: 'b-c', from: 'b', to: 'c', kind: 'writes' },
      { op: 'applyStylePreset', preset: 'professional-software' }
    ]
  });
  const edge = scene.elements.find((element) => meta(element).semanticId === 'b-c');
  assert.equal(edge.strokeColor, '#b45309');
  assert.equal(edge.strokeStyle, 'solid');
  assert.equal(meta(edge).styleRole, 'data-write');
  assert.equal(meta(edge).styleSource, 'kind');
  assert.equal(scene.customData.excalidrawSkill.stylePreset, 'professional-software');
});

test('applyStylePreset rejects an unknown preset through the shared resolver', () => {
  assert.throws(
    () => applyPatch(baseScene(), { operations: [{ op: 'applyStylePreset', preset: 'unknown-style' }] }),
    /Unsupported style preset/
  );
});

test('unknown patch operations fail instead of silently doing nothing', () => {
  assert.throws(
    () => applyPatch(baseScene(), { operations: [{ op: 'teleportNode', target: 'a' }] }),
    /Unsupported patch operation/
  );
});
