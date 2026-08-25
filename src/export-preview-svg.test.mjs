import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { exportPreviewSvg } from './export-preview-svg.mjs';

test('exports a deterministic SVG preview for visual review', () => {
  const scene = renderSpec({
    nodes: [
      { semanticId: 'web', label: 'Web App', shapeRef: 'client.web' },
      { semanticId: 'api', label: 'API Gateway', shapeRef: 'gateway.api' }
    ],
    edges: [{ semanticId: 'web-api', from: 'web', to: 'api', kind: 'calls' }]
  });

  const first = exportPreviewSvg(scene);
  const second = exportPreviewSvg(scene);
  assert.equal(first, second);
  assert.match(first, /^<svg /);
  assert.match(first, /Web App/);
  assert.match(first, /API Gateway/);
  assert.match(first, /marker-end="url\(#arrowhead\)"/);
  assert.ok(!first.includes('undefined'));
});

test('escapes labels in preview output', () => {
  const scene = renderSpec({
    nodes: [{ semanticId: 'a', label: 'A < B & C', shapeRef: 'service.backend' }],
    edges: []
  });
  const svg = exportPreviewSvg(scene);
  assert.match(svg, /A &lt; B &amp; C/);
});
