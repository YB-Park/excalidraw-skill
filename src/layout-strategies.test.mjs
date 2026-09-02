import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT_STRATEGIES, applyLayoutStrategy } from './layout-strategies.mjs';

test('layout strategy portfolio is intentionally small and semantic', () => {
  assert.deepEqual(LAYOUT_STRATEGIES.map((entry) => entry.id), ['narrative', 'compact', 'structured']);
  for (const strategy of LAYOUT_STRATEGIES) assert.match(strategy.intent, /./);
});

test('compact strategy changes aspect preference without mutating source spec', () => {
  const source = { diagramType: 'service-flow', layout: { profile: 'swimlane-flow', aspectRatio: 'balanced' } };
  const result = applyLayoutStrategy(source, 'compact');
  assert.equal(source.layout.aspectRatio, 'balanced');
  assert.equal(result.layout.aspectRatio, 'tall');
  assert.equal(result.layout.profile, 'swimlane-flow');
  assert.equal(result.layoutStrategy.id, 'compact');
});

test('structured flow strategy deliberately switches to layered-flow', () => {
  const source = { diagramType: 'service-flow', layout: { profile: 'swimlane-flow', aspectRatio: 'wide' } };
  const result = applyLayoutStrategy(source, 'structured');
  assert.equal(result.layout.profile, 'layered-flow');
  assert.equal(result.layout.aspectRatio, 'balanced');
});

test('structured strategy does not silently change non-flow family profile', () => {
  const source = { diagramType: 'system-architecture', layout: { profile: 'layered-system' } };
  const result = applyLayoutStrategy(source, 'structured');
  assert.equal(result.layout.profile, 'layered-system');
});
