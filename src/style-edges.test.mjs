import test from 'node:test';
import assert from 'node:assert/strict';
import { styleEdges } from './style-edges.mjs';

function edge(id, kind, visual = undefined) {
  return {
    id,
    type: 'arrow',
    strokeColor: '#111827',
    strokeStyle: 'solid',
    strokeWidth: 2,
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, kind, ...(visual ? { visual } : {}) } }
  };
}

test('distinguishes runtime calls from dependencies', () => {
  const call = edge('call', 'calls');
  const dependency = edge('dependency', 'depends-on');
  styleEdges({ elements: [call, dependency] });
  assert.notEqual(`${call.strokeColor}:${call.strokeStyle}`, `${dependency.strokeColor}:${dependency.strokeStyle}`);
  assert.equal(call.customData.excalidrawSkill.styleRole, 'runtime-call');
  assert.equal(dependency.customData.excalidrawSkill.styleRole, 'dependency');
  assert.equal(call.customData.excalidrawSkill.styleSource, 'kind');
});

test('distinguishes async, read, write, retry, and failure relations', () => {
  const elements = [
    edge('async', 'publishes'),
    edge('read', 'reads'),
    edge('write', 'writes'),
    edge('retry', 'retries'),
    edge('failure', 'fails-to')
  ];
  styleEdges({ elements });
  const signatures = new Set(elements.map((element) => `${element.strokeColor}:${element.strokeStyle}:${element.customData.excalidrawSkill.styleRole}`));
  assert.equal(signatures.size, elements.length);
});

test('edge visual intent overrides kind-based styling', () => {
  const dataPlane = edge('data-plane', 'transfers', { role: 'data-plane', emphasis: 'critical', stroke: 'solid' });
  styleEdges({ elements: [dataPlane] });

  assert.equal(dataPlane.strokeColor, '#dc2626');
  assert.equal(dataPlane.strokeWidth, 4);
  assert.equal(dataPlane.strokeStyle, 'solid');
  assert.equal(dataPlane.opacity, 100);
  assert.equal(dataPlane.customData.excalidrawSkill.styleRole, 'visual-data-plane');
  assert.equal(dataPlane.customData.excalidrawSkill.styleSource, 'edge.visual');
  assert.deepEqual(dataPlane.customData.excalidrawSkill.visual, {
    role: 'data-plane',
    emphasis: 'critical',
    stroke: 'solid'
  });
});

test('edge visual stroke choice survives final styling pass', () => {
  const eventStream = edge('event-stream', 'publishes', { role: 'event-stream', stroke: 'dotted' });
  styleEdges({ elements: [eventStream] });

  assert.equal(eventStream.strokeColor, '#0891b2');
  assert.equal(eventStream.strokeWidth, 2);
  assert.equal(eventStream.strokeStyle, 'dotted');
  assert.equal(eventStream.customData.excalidrawSkill.styleSource, 'edge.visual');
});

test('leaves unknown edge kinds unchanged', () => {
  const unknown = edge('unknown', 'custom-kind');
  styleEdges({ elements: [unknown] });
  assert.equal(unknown.strokeColor, '#111827');
  assert.equal(unknown.strokeStyle, 'solid');
  assert.equal(unknown.customData.excalidrawSkill.styleRole, undefined);
});
