import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRenderSignature, hammingDistance } from './verify-actual-render-signatures.mjs';

test('counts dHash bit differences', () => {
  assert.equal(hammingDistance('0000000000000000', '0000000000000000'), 0);
  assert.equal(hammingDistance('0000000000000000', '000000000000000f'), 4);
  assert.equal(hammingDistance('ffffffffffffffff', '0000000000000000'), 64);
});

test('accepts small perceptual drift within the configured threshold', () => {
  const result = compareRenderSignature(
    { width: 100, height: 60, dhash: '0000000000000000' },
    { width: 100, height: 60, dhash: '000000000000000f' },
    4
  );
  assert.equal(result.pass, true);
  assert.equal(result.dimensionsMatch, true);
  assert.equal(result.hammingDistance, 4);
});

test('rejects dimension drift even when the perceptual hash matches', () => {
  const result = compareRenderSignature(
    { width: 100, height: 60, dhash: '1234567890abcdef' },
    { width: 101, height: 60, dhash: '1234567890abcdef' },
    4
  );
  assert.equal(result.pass, false);
  assert.equal(result.dimensionsMatch, false);
});

test('rejects visual drift beyond the configured threshold', () => {
  const result = compareRenderSignature(
    { width: 100, height: 60, dhash: '0000000000000000' },
    { width: 100, height: 60, dhash: '00000000000000ff' },
    4
  );
  assert.equal(result.pass, false);
  assert.equal(result.hammingDistance, 8);
});
