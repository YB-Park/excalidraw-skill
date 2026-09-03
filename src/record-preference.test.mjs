import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPreference } from './record-preference.mjs';

const corpus = {
  version: '1.0',
  status: 'collecting',
  cases: []
};

const manifest = {
  blindCandidates: [
    { candidateId: 'c01' },
    { candidateId: 'c02' },
    { candidateId: 'c03' }
  ]
};

test('records only explicit human-confirmed rankings over opaque candidate IDs', () => {
  const next = recordPreference({
    corpus,
    manifest,
    scenario: 'payment-approval',
    ranking: ['c02', 'c01', 'c03'],
    note: 'clearer retry path',
    humanConfirmed: true,
    timestamp: '2026-09-03T03:00:00.000Z',
    manifestPath: 'examples/example.candidates.json'
  });

  assert.equal(corpus.cases.length, 0, 'source corpus must not be mutated');
  assert.deepEqual(next.cases, [{
    scenario: 'payment-approval',
    ranking: ['c02', 'c01', 'c03'],
    source: 'human',
    humanConfirmed: true,
    inspectedActualImages: true,
    timestamp: '2026-09-03T03:00:00.000Z',
    manifestPath: 'examples/example.candidates.json',
    note: 'clearer retry path'
  }]);
});

test('refuses assistant or unconfirmed preference evidence', () => {
  assert.throws(() => recordPreference({
    corpus,
    manifest,
    scenario: 'payment-approval',
    ranking: ['c01', 'c02', 'c03'],
    humanConfirmed: false
  }), /human-confirmed/i);
});

test('requires every manifest candidate exactly once and keeps opaque IDs', () => {
  assert.throws(() => recordPreference({
    corpus,
    manifest,
    scenario: 'payment-approval',
    ranking: ['c01', 'c02'],
    humanConfirmed: true
  }), /every manifest candidate/i);

  assert.throws(() => recordPreference({
    corpus,
    manifest: { blindCandidates: [{ candidateId: 'narrative' }, { candidateId: 'compact' }] },
    scenario: 'payment-approval',
    ranking: ['narrative', 'compact'],
    humanConfirmed: true
  }), /opaque candidate IDs/i);
});
