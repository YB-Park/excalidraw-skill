import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateSpecs } from './generate-candidates.mjs';

test('candidateSpecs produces three meaningfully different flow strategies', () => {
  const source = {
    diagramType: 'service-flow',
    outputPath: 'diagram.excalidraw',
    layout: { profile: 'swimlane-flow', aspectRatio: 'balanced' }
  };
  const candidates = candidateSpecs(source);
  assert.deepEqual(candidates.map((entry) => entry.strategy.id), ['narrative', 'compact', 'structured']);
  assert.equal(candidates[0].spec.layout.profile, 'swimlane-flow');
  assert.equal(candidates[1].spec.layout.aspectRatio, 'tall');
  assert.equal(candidates[2].spec.layout.profile, 'hub-and-spoke');
  assert.equal(source.layout.profile, 'swimlane-flow');
});
