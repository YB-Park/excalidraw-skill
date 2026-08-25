import test from 'node:test';
import assert from 'node:assert/strict';
import { fitEdgeLabel } from './edge-label-fit.mjs';

function horizontalEdge(length) {
  return {
    x: 0,
    y: 0,
    width: length,
    height: 0,
    points: [[0, 0], [length, 0]]
  };
}

function verticalEdge(length) {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: length,
    points: [[0, 0], [0, length]]
  };
}

test('shrinks a short edge label to its visible text instead of a fixed 112px box', () => {
  const fitted = fitEdgeLabel('uses', horizontalEdge(70));
  assert.equal(fitted.lineCount, 1);
  assert.ok(fitted.width < 70);
  assert.ok(fitted.width >= 32);
});

test('wraps a relation label when a short horizontal corridor cannot fit it on one line', () => {
  const fitted = fitEdgeLabel('connect / disconnect', horizontalEdge(90));
  assert.equal(fitted.lineCount, 2);
  assert.ok(fitted.width <= 82);
  assert.ok(fitted.height > 22);
});

test('keeps ordinary labels on one line when the route has enough room', () => {
  const fitted = fitEdgeLabel('normalized records', horizontalEdge(260));
  assert.equal(fitted.lineCount, 1);
  assert.ok(fitted.width < 180);
});

test('wraps a wide relation beside a vertical edge to preserve side corridors', () => {
  const fitted = fitEdgeLabel('temporary failure', verticalEdge(126));
  assert.equal(fitted.lineCount, 2);
  assert.ok(fitted.width <= 96);
  assert.ok(fitted.height > 22);
});
