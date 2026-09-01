import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyQualityPatch } from './quality-patch.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const source = JSON.parse(fs.readFileSync(
  path.join(rootDir, 'examples/service-flow/payment-flow.visual-plan.excalidraw'),
  'utf8'
));

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function semantic(scene, role, semanticId) {
  return (scene.elements ?? []).find((element) => {
    const meta = metaOf(element);
    return meta.role === role && meta.semanticId === semanticId;
  }) ?? null;
}

function nodePosition(scene, semanticId) {
  const node = semantic(scene, 'node', semanticId);
  assert.ok(node, `missing node ${semanticId}`);
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

function assertPositionEqual(actual, expected, label) {
  assert.deepEqual(
    { x: actual.x, y: actual.y },
    { x: expected.x, y: expected.y },
    `${label} moved unexpectedly`
  );
}

test('removeObject removes the worker and connected edge without moving unrelated primary nodes', () => {
  const beforePayment = nodePosition(source, 'payment-service');
  const beforeNetwork = nodePosition(source, 'card-network');
  const scene = applyQualityPatch(structuredClone(source), {
    preserveManualLayout: true,
    operations: [{ op: 'removeObject', target: 'settlement-worker' }]
  });

  assert.equal(semantic(scene, 'node', 'settlement-worker'), null);
  assert.equal(semantic(scene, 'edge', 'events-to-worker'), null);
  assertPositionEqual(nodePosition(scene, 'payment-service'), beforePayment, 'payment-service');
  assertPositionEqual(nodePosition(scene, 'card-network'), beforeNetwork, 'card-network');
});

test('moveNear moves only the requested worker below the event queue and reroutes its edge', () => {
  const beforePayment = nodePosition(source, 'payment-service');
  const beforeNetwork = nodePosition(source, 'card-network');
  const scene = applyQualityPatch(structuredClone(source), {
    preserveManualLayout: true,
    operations: [{
      op: 'moveNear',
      target: 'settlement-worker',
      near: 'payment-events',
      side: 'down',
      gap: 80
    }]
  });

  const events = nodePosition(scene, 'payment-events');
  const worker = nodePosition(scene, 'settlement-worker');
  assert.ok(worker.y >= events.y + events.height + 70, 'worker should stay on the requested down side');
  assert.ok(semantic(scene, 'edge', 'events-to-worker'));
  assertPositionEqual(nodePosition(scene, 'payment-service'), beforePayment, 'payment-service');
  assertPositionEqual(nodePosition(scene, 'card-network'), beforeNetwork, 'card-network');
});

test('updateLabel keeps semantic identity and native binding for a longer primary node label', () => {
  const beforeWeb = nodePosition(source, 'web-app');
  const scene = applyQualityPatch(structuredClone(source), {
    preserveManualLayout: true,
    operations: [{
      op: 'updateLabel',
      target: 'payment-service',
      label: 'Payment Authorization Service'
    }]
  });

  const node = semantic(scene, 'node', 'payment-service');
  assert.ok(node);
  const label = (scene.elements ?? []).find((element) => {
    const meta = metaOf(element);
    return meta.role === 'label' && meta.node === 'payment-service';
  });
  assert.ok(label, 'bound payment-service label should remain');
  assert.equal(label.text, 'Payment Authorization Service');
  assert.equal(label.containerId, node.id);
  assertPositionEqual(nodePosition(scene, 'web-app'), beforeWeb, 'web-app');
});

test('edge edit can rewire an existing semantic edge without moving unrelated nodes', () => {
  const beforePayment = nodePosition(source, 'payment-service');
  const beforeEvents = nodePosition(source, 'payment-events');
  const scene = applyQualityPatch(structuredClone(source), {
    preserveManualLayout: true,
    operations: [
      { op: 'removeObject', target: 'events-to-worker' },
      {
        op: 'addEdge',
        semanticId: 'events-to-worker',
        from: 'payment-db',
        to: 'settlement-worker',
        label: 'settle',
        kind: 'sync'
      }
    ]
  });

  const edge = semantic(scene, 'edge', 'events-to-worker');
  assert.ok(edge);
  const meta = metaOf(edge);
  assert.equal(meta.from, 'payment-db');
  assert.equal(meta.to, 'settlement-worker');
  assertPositionEqual(nodePosition(scene, 'payment-service'), beforePayment, 'payment-service');
  assertPositionEqual(nodePosition(scene, 'payment-events'), beforeEvents, 'payment-events');
});
