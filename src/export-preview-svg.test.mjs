import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpec } from './render.mjs';
import { exportPreviewSvg } from './export-preview-svg.mjs';

function viewBox(svg) {
  const match = svg.match(/viewBox="([^"]+)"/);
  assert.ok(match, 'preview should declare a viewBox');
  const [x, y, width, height] = match[1].split(/\s+/).map(Number);
  return { x, y, width, height, right: x + width, bottom: y + height };
}

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

test('includes text extending beyond non-text geometry in preview bounds', () => {
  const scene = {
    elements: [
      { id: 'node', type: 'rectangle', x: 100, y: 100, width: 180, height: 80, isDeleted: false },
      {
        id: 'edge-label', type: 'text', x: -90, y: 120, width: 120, height: 24,
        text: 'alert rules', fontSize: 18, lineHeight: 1.25, isDeleted: false,
        customData: { excalidrawSkill: { role: 'edge-label', edge: 'alerts' } }
      }
    ]
  };
  const bounds = viewBox(exportPreviewSvg(scene));
  assert.ok(bounds.x <= -150, `expected 60px left margin around text, got viewBox x=${bounds.x}`);
  assert.ok(bounds.right >= 340, 'node geometry should remain fully visible with margin');
});

test('includes orthogonal polyline detours outside endpoint box in preview bounds', () => {
  const scene = {
    elements: [
      {
        id: 'edge', type: 'arrow', x: 100, y: 100, width: 200, height: 80,
        points: [[0, 0], [-120, 0], [-120, 80], [200, 80]],
        endArrowhead: 'arrow', isDeleted: false
      }
    ]
  };
  const bounds = viewBox(exportPreviewSvg(scene));
  assert.equal(bounds.x, -80);
  assert.equal(bounds.right, 360);
});
