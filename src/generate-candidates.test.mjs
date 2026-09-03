import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateSpecs, blindCandidateView } from './generate-candidates.mjs';

test('candidateSpecs produces three meaningfully different flow strategies behind opaque ids', () => {
  const source = {
    diagramType: 'service-flow',
    outputPath: 'diagram.excalidraw',
    nodes: [
      { semanticId: 'checkout', layoutHints: { importance: 'primary', rank: 0 } },
      { semanticId: 'risk', layoutHints: { importance: 'primary', rank: 1 } },
      { semanticId: 'approve', layoutHints: { importance: 'primary', rank: 2 } }
    ],
    layout: { profile: 'swimlane-flow', aspectRatio: 'balanced', primaryFlow: ['checkout', 'risk', 'approve'] }
  };
  const candidates = candidateSpecs(source);
  assert.deepEqual(candidates.map((entry) => entry.candidateId), ['c01', 'c02', 'c03']);
  assert.deepEqual(candidates.map((entry) => entry.strategy.id), ['narrative', 'compact', 'structured']);
  assert.equal(candidates[0].spec.layout.profile, 'swimlane-flow');
  assert.equal(candidates[1].spec.layout.aspectRatio, 'tall');
  assert.equal(candidates[2].spec.layout.profile, 'layered-flow');
  assert.equal(candidates[2].spec.layout.aspectRatio, 'balanced');
  assert.equal(source.layout.profile, 'swimlane-flow');
});

test('candidate portfolio refuses families without three proven distinct strategies', () => {
  assert.throws(
    () => candidateSpecs({ diagramType: 'system-architecture', outputPath: 'system.excalidraw', layout: { profile: 'layered-system' } }),
    /flow families only/i
  );
  assert.throws(
    () => candidateSpecs({ diagramType: 'module-architecture', outputPath: 'module.excalidraw', layout: { profile: 'component-view' } }),
    /flow families only/i
  );
});

test('blindCandidateView removes strategy and intent metadata from critic handoff', () => {
  const blind = blindCandidateView({
    candidates: [{
      candidateId: 'c01',
      strategy: 'narrative',
      intent: 'primary story continuity',
      scenePath: '/tmp/diagram.candidate-c01.excalidraw',
      previewPath: '/tmp/diagram.candidate-c01.preview.png',
      reviewPath: '/tmp/diagram.candidate-c01.review.json'
    }]
  });
  assert.deepEqual(blind, [{
    candidateId: 'c01',
    scenePath: '/tmp/diagram.candidate-c01.excalidraw',
    previewPath: '/tmp/diagram.candidate-c01.preview.png',
    reviewPath: '/tmp/diagram.candidate-c01.review.json'
  }]);
  assert.doesNotMatch(JSON.stringify(blind), /narrative|primary story/i);
});
