import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEvaluationSuites, selectCases, summarizeResults } from './evaluate-suite.mjs';

const suite = {
  cases: [
    { id: 'flow-a', family: 'flow' },
    { id: 'flow-b', family: 'flow' },
    { id: 'system-a', family: 'system-architecture' }
  ]
};

test('selectCases filters by family and case id', () => {
  assert.deepEqual(selectCases(suite, { family: 'flow' }).map((entry) => entry.id), ['flow-a', 'flow-b']);
  assert.deepEqual(selectCases(suite, { caseId: 'system-a' }).map((entry) => entry.id), ['system-a']);
});

test('mergeEvaluationSuites adds quality cases without duplicate ids', () => {
  const merged = mergeEvaluationSuites(suite, {
    version: '0.1',
    cases: [
      { id: 'flow-a', family: 'flow' },
      { id: 'quality-flow-c', family: 'flow' }
    ]
  });
  assert.deepEqual(merged.cases.map((entry) => entry.id), ['flow-a', 'flow-b', 'system-a', 'quality-flow-c']);
  assert.equal(merged.qualityCorpusVersion, '0.1');
});

test('summarizeResults distinguishes runnable and contract-only cases', () => {
  const summary = summarizeResults([
    { status: 'passed' },
    { status: 'failed' },
    { status: 'contract-only' },
    { status: 'missing-fixture' }
  ]);
  assert.equal(summary.runnable, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.contractOnly, 1);
  assert.equal(summary.missingFixture, 1);
  assert.equal(summary.structuralPass, false);
  assert.equal(summary.pass, false);
});

test('perceptual warnings stay advisory by default', () => {
  const summary = summarizeResults([
    { status: 'passed', perceptualWarnings: [{ kind: 'edge-bend-complexity' }] }
  ]);
  assert.equal(summary.structuralPass, true);
  assert.equal(summary.perceptualWarnings, 1);
  assert.equal(summary.perceptualPass, false);
  assert.equal(summary.strictPerceptual, false);
  assert.equal(summary.pass, true);
});

test('strict perceptual mode fails when any runnable case has a warning', () => {
  const summary = summarizeResults([
    { status: 'passed', perceptualWarnings: [{ kind: 'ambiguous-edge-label-association' }] },
    { status: 'passed', perceptualWarnings: [] }
  ], { strictPerceptual: true });
  assert.equal(summary.structuralPass, true);
  assert.equal(summary.perceptualWarnings, 1);
  assert.equal(summary.perceptualPass, false);
  assert.equal(summary.strictPerceptual, true);
  assert.equal(summary.pass, false);
});

test('strict perceptual mode passes a zero-warning runnable suite', () => {
  const summary = summarizeResults([
    { status: 'passed', perceptualWarnings: [] },
    { status: 'passed', perceptualWarnings: [] },
    { status: 'contract-only' }
  ], { strictPerceptual: true });
  assert.equal(summary.structuralPass, true);
  assert.equal(summary.perceptualPass, true);
  assert.equal(summary.strictPerceptual, true);
  assert.equal(summary.pass, true);
});
