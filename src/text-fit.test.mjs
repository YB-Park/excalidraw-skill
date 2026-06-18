import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTextWidth, fitNodeLabel, textElementOverflows } from './text-fit.mjs';

test('wraps a long node label without truncation', () => {
  const fit = fitNodeLabel('Payment Events Topic');
  assert.equal(fit.overflow, false);
  assert.ok(fit.lineCount <= 2);
  assert.equal(fit.lines.join(' '), 'Payment Events Topic');
});

test('accounts for Korean glyph width', () => {
  assert.ok(estimateTextWidth('결제', 18) > estimateTextWidth('Pay', 18));
  assert.equal(fitNodeLabel('고객 신원 확인 서비스').overflow, false);
});

test('detects rendered text overflow', () => {
  assert.equal(textElementOverflows({ text: 'Payment Events Topic', fontSize: 18, width: 100, height: 28, lineHeight: 1.25 }).overflow, true);
});
