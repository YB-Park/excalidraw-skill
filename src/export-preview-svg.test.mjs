import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { exportPreviewSvg, sceneBounds } from './export-preview-svg.mjs';

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
  for (const line of first.split('\n').filter((value) => value.includes('<polyline '))) {
    assert.equal((line.match(/\sfill=/g) ?? []).length, 1);
  }
});

test('escapes labels in preview output', () => {
  const scene = renderSpec({
    nodes: [{ semanticId: 'a', label: 'A < B & C', shapeRef: 'service.backend' }],
    edges: []
  });
  const svg = exportPreviewSvg(scene);
  assert.match(svg, /A &lt; B &amp; C/);
});

test('keeps required node labels inside the padded preview bounds', () => {
  const scene = {
    elements: [
      { type: 'rectangle', x: 100, y: 100, width: 120, height: 60 },
      { type: 'text', x: 0, y: 110, width: 100, height: 24, text: 'Order fulfillment' }
    ]
  };

  const bounds = sceneBounds(scene.elements);
  assert.ok(bounds.x <= 0 - 60);
  assert.ok(bounds.x + bounds.width >= 100 + 60);
  assert.match(exportPreviewSvg(scene), /viewBox="-60 40 /);
});

test('keeps left-placed edge labels inside the preview bounds', () => {
  const scene = {
    elements: [
      { type: 'rectangle', x: 200, y: 100, width: 120, height: 60 },
      { type: 'arrow', x: 0, y: 130, width: 200, height: 0, points: [[0, 0], [200, 0]] },
      { type: 'text', x: -90, y: 110, width: 80, height: 20, text: 'metrics pipeline' }
    ]
  };

  const bounds = sceneBounds(scene.elements);
  assert.ok(bounds.x <= -150);
  assert.ok(bounds.x + bounds.width >= 380);
  assert.match(exportPreviewSvg(scene), /viewBox="-150 40 /);
});

test('keeps generated frame titles inside the preview bounds', () => {
  const scene = {
    elements: [
      { type: 'frame', x: 100, y: 100, width: 20, height: 40, name: 'Observability pipeline' }
    ]
  };

  const bounds = sceneBounds(scene.elements);
  assert.ok(bounds.x <= 110 - 60);
  assert.ok(bounds.x + bounds.width >= 110 + 'Observability pipeline'.length * 16 + 60);
  assert.ok(bounds.y <= 72 - 60);
});
