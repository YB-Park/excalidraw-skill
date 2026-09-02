import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCandidateScenes, isMeaningfullyDistinct, evaluateCandidateDiversity } from './candidate-diversity.mjs';

function scene(points) {
  return {
    elements: Object.entries(points).map(([semanticId, [x, y]]) => ({
      id: semanticId,
      type: 'rectangle',
      x,
      y,
      width: 100,
      height: 60,
      customData: { excalidrawSkill: { role: 'node', semanticId } }
    }))
  };
}

test('uniform translation is not mistaken for candidate diversity', () => {
  const left = scene({ a: [0, 0], b: [200, 0], c: [200, 200] });
  const right = scene({ a: [100, 100], b: [300, 100], c: [300, 300] });
  const metrics = compareCandidateScenes(left, right);
  assert.equal(metrics.normalizedRms, 0);
  assert.equal(isMeaningfullyDistinct(metrics), false);
});

test('meaningfully different composition passes normalized diversity', () => {
  const left = scene({ a: [0, 0], b: [200, 0], c: [200, 200] });
  const right = scene({ a: [100, 0], b: [100, 200], c: [300, 100] });
  const metrics = compareCandidateScenes(left, right);
  assert.ok(metrics.normalizedRms >= 0.12);
  assert.equal(isMeaningfullyDistinct(metrics), true);
});

test('compactness change can be meaningful even when relative topology is preserved', () => {
  const left = scene({ a: [0, 0], b: [200, 0], c: [400, 0] });
  const right = scene({ a: [0, 0], b: [180, 0], c: [360, 0] });
  const metrics = compareCandidateScenes(left, right);
  assert.equal(metrics.normalizedRms, 0);
  assert.ok(metrics.widthRatio >= 1.08);
  assert.equal(isMeaningfullyDistinct(metrics), true);
});

test('portfolio evaluation rejects one near-duplicate pair', () => {
  const scenes = {
    a: scene({ a: [0, 0], b: [200, 0], c: [200, 200] }),
    b: scene({ a: [10, 10], b: [210, 10], c: [210, 210] }),
    c: scene({ a: [100, 0], b: [100, 200], c: [300, 100] })
  };
  const report = evaluateCandidateDiversity({
    candidates: [
      { strategy: 'a', scenePath: 'a' },
      { strategy: 'b', scenePath: 'b' },
      { strategy: 'c', scenePath: 'c' }
    ]
  }, { readScene: (key) => scenes[key] });
  assert.equal(report.ok, false);
  assert.equal(report.comparisons.find((entry) => entry.left === 'a' && entry.right === 'b').distinct, false);
});
