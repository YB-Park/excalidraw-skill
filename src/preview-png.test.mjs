import assert from 'node:assert/strict';
import test from 'node:test';
import { exportPreviewPng, isPngBuffer } from './export-preview-png.mjs';
import { renderSpec } from './render.mjs';

test('portable preview produces a real PNG from an Excalidraw scene', () => {
  const scene = renderSpec({
    diagramType: 'service-flow',
    nodes: [
      { semanticId: 'client', label: 'Client', shapeRef: 'client.web' },
      { semanticId: 'api', label: 'API', shapeRef: 'service.backend' }
    ],
    edges: [
      { semanticId: 'client-api', from: 'client', to: 'api', label: 'request', kind: 'calls' }
    ]
  });

  const png = exportPreviewPng(scene);
  assert.equal(isPngBuffer(png), true);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.ok(png.length > 100);
});
