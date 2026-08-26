import test from 'node:test';
import assert from 'node:assert/strict';
import { validateActualRenderCoverage } from './render-actual-suite.mjs';

const suite = {
  cases: [
    { id: 'flow-a', implementationStatus: 'runnable', fixture: 'a.json' },
    { id: 'flow-b', implementationStatus: 'runnable', fixture: 'b.json' },
    { id: 'future-c', implementationStatus: 'contract-only' }
  ]
};

test('actual-render manifest covers every runnable case exactly once', () => {
  assert.deepEqual(validateActualRenderCoverage(suite, {
    cases: {
      'flow-a': 'flow-a.png',
      'flow-b': 'flow-b.png'
    }
  }), {
    pass: true,
    runnableCount: 2,
    configuredCount: 2,
    missing: [],
    unexpected: [],
    invalidFileNames: [],
    duplicates: []
  });
});

test('actual-render manifest rejects missing and unexpected cases', () => {
  const result = validateActualRenderCoverage(suite, {
    cases: {
      'flow-a': 'flow-a.png',
      'stale-flow': 'stale-flow.png'
    }
  });
  assert.equal(result.pass, false);
  assert.deepEqual(result.missing, ['flow-b']);
  assert.deepEqual(result.unexpected, ['stale-flow']);
});

test('actual-render manifest rejects duplicate or unstable file names', () => {
  const result = validateActualRenderCoverage(suite, {
    cases: {
      'flow-a': 'same.png',
      'flow-b': 'same.png'
    }
  });
  assert.equal(result.pass, false);
  assert.deepEqual(result.duplicates, ['same.png']);

  const invalid = validateActualRenderCoverage(suite, {
    cases: {
      'flow-a': '../flow-a.png',
      'flow-b': 'flow-b.png'
    }
  });
  assert.equal(invalid.pass, false);
  assert.deepEqual(invalid.invalidFileNames, ['flow-a']);
});
