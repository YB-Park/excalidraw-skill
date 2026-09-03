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

test('structured multi-step flow switches to layered-flow to preserve sequence semantics', () => {
  const source = {
    diagramType: 'service-flow',
    layout: { profile: 'swimlane-flow', aspectRatio: 'wide', primaryFlow: ['checkout', 'risk', 'approve'] }
  };
  const result = applyLayoutStrategy(source, 'structured');
  assert.equal(result.layout.profile, 'layered-flow');
  assert.equal(result.layout.aspectRatio, 'balanced');
});

test('structured infers multi-step primary flow from ranked primary nodes', () => {
  const source = {
    diagramType: 'event-flow',
    nodes: [
      { semanticId: 'accepted', layoutHints: { importance: 'primary', rank: 0 } },
      { semanticId: 'inventory', layoutHints: { importance: 'primary', rank: 1 } },
      { semanticId: 'retry', layoutHints: { importance: 'secondary', rank: 1 } }
    ],
    layout: { profile: 'swimlane-flow', aspectRatio: 'wide' }
  };
  const result = applyLayoutStrategy(source, 'structured');
  assert.equal(result.layout.profile, 'layered-flow');
});

test('structured true hub topology still switches to hub-and-spoke', () => {
  const source = {
    diagramType: 'service-flow',
    layout: { profile: 'swimlane-flow', aspectRatio: 'wide', primaryFlow: ['hub'] }
  };
  const result = applyLayoutStrategy(source, 'structured');
  assert.equal(result.layout.profile, 'hub-and-spoke');
  assert.equal(result.layout.aspectRatio, 'balanced');
});

test('structured strategy does not silently change non-flow family profile', () => {
  const source = { diagramType: 'system-architecture', layout: { profile: 'layered-system' } };
  const result = applyLayoutStrategy(source, 'structured');
  assert.equal(result.layout.profile, 'layered-system');
});
