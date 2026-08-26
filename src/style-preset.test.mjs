import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STYLE_PRESET,
  baseElementStyle,
  canvasStyle,
  componentDetailStyles,
  edgeKindStyleFor,
  edgeLabelStyle,
  edgeVisualStyleFor,
  fontTokens,
  frameStyle,
  loadStylePreset,
  nodeStyleFor,
  roleFor
} from './style-preset.mjs';

test('loads the professional preset as a runtime-complete style source', () => {
  const preset = loadStylePreset(DEFAULT_STYLE_PRESET);
  assert.equal(preset.name, 'professional-software');
  assert.equal(preset.version, '2.3');
  assert.equal(preset.base.roughness, 0.7);
  assert.ok(preset.roles.model);
  assert.ok(preset.edgeKinds.calls);
  assert.ok(preset.edgeVisualRoles['data-plane']);
  assert.ok(preset.edgeEmphasis.critical);
  assert.ok(preset.componentDetails.database);
});

test('resolves node roles and styles from the preset', () => {
  assert.equal(roleFor('gateway.api'), 'gateway');
  assert.equal(roleFor('domain.state'), 'model');
  assert.deepEqual(nodeStyleFor('gateway.api'), {
    strokeColor: '#2563eb',
    backgroundColor: '#eff6ff'
  });
  assert.deepEqual(nodeStyleFor('domain.state'), {
    strokeColor: '#334155',
    backgroundColor: '#f8fafc'
  });
});

test('resolves edge kind and visual styles from the same preset', () => {
  assert.deepEqual(edgeKindStyleFor('calls'), {
    strokeColor: '#2563eb',
    strokeStyle: 'solid',
    strokeWidth: 2,
    role: 'runtime-call'
  });
  const critical = edgeVisualStyleFor({ role: 'data-plane', emphasis: 'critical', stroke: 'solid' });
  assert.deepEqual(critical.visual, {
    role: 'data-plane',
    emphasis: 'critical',
    stroke: 'solid'
  });
  assert.deepEqual(critical.style, {
    strokeColor: '#dc2626',
    strokeWidth: 4,
    strokeStyle: 'solid',
    opacity: 100
  });
});

test('exposes base, frame, label, canvas, font, and component styles from one preset', () => {
  assert.deepEqual(baseElementStyle(), {
    strokeColor: '#1f2937',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0.7,
    opacity: 100
  });
  assert.equal(frameStyle().strokeColor, '#9ca3af');
  assert.equal(edgeLabelStyle().placedBackgroundColor, '#ffffff');
  assert.equal(canvasStyle().backgroundColor, '#ffffff');
  assert.deepEqual(fontTokens(), { default: 2, mono: 3, sketch: 5 });
  assert.equal(componentDetailStyles().queue.strokeColor, '#9333ea');
});

test('rejects unknown style presets deterministically', () => {
  assert.throws(() => loadStylePreset('missing-preset'), /Unsupported style preset/u);
});
