import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreferenceRecords } from './preference-evaluation.mjs';

test('preference evaluator separates agreement, stability, and human escalation', () => {
  const report = evaluatePreferenceRecords([
    {
      humanRanking: ['b', 'a', 'c'],
      criticRuns: [
        { ranking: ['b', 'a', 'c'], humanDecisionRecommended: false },
        { ranking: ['b', 'c', 'a'], humanDecisionRecommended: false }
      ]
    },
    {
      humanRanking: ['a', 'b', 'c'],
      criticRuns: [
        { ranking: ['c', 'a', 'b'], humanDecisionRecommended: true },
        { ranking: ['a', 'b', 'c'], humanDecisionRecommended: true }
      ]
    }
  ]);

  assert.equal(report.cases, 2);
  assert.equal(report.runs, 4);
  assert.equal(report.top1Agreement, 0.75);
  assert.equal(report.top1Stability, 0.5);
  assert.equal(report.humanEscalationRate, 0.5);
  assert.ok(report.pairwiseAgreement > 0.5 && report.pairwiseAgreement < 1);
});

test('empty preference corpus reports null rates rather than fake success', () => {
  assert.deepEqual(evaluatePreferenceRecords([]), {
    cases: 0,
    runs: 0,
    top1Agreement: null,
    pairwiseAgreement: null,
    top1Stability: null,
    humanEscalationRate: null
  });
});
