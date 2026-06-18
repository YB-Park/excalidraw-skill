import test from 'node:test';
import assert from 'node:assert/strict';
import { styleEdges } from './style-edges.mjs';

function edge(id, kind) {
  return {
    id,
    type: 'arrow',
    strokeColor: '#111827',
    strokeStyle: 'solid',
    customData: { excalidrawSkill: { role: 'edge', semanticId: id, kind } }
  };
}

test('distinguishes runtime calls from dependencies', () => {
  const call = edge('call', 'calls');
  const dependency = edge('dependency', 'depends-on');
  styleEdges({ elements: [call, dependency] });
  assert.notEqual(`${call.strokeColor}:${call.strokeStyle}`, `${dependency.strokeColor}:${dependency.strokeStyle}`);
  assert.equal(call.customData.excalidrawSkill.styleRole, 'runtime-call');
  assert.equal(dependency.customData.excalidrawSkill.styleRole, 'dependency');
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

test('leaves unknown edge kinds unchanged', () => {
  const unknown = edge('unknown', 'custom-kind');
  styleEdges({ elements: [unknown] });
  assert.equal(unknown.strokeColor, '#111827');
  assert.equal(unknown.strokeStyle, 'solid');
  assert.equal(unknown.customData.excalidrawSkill.styleRole, undefined);
});
