import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const consumers = [
  'render.mjs',
  'style-by-kind.mjs',
  'style-edges.mjs',
  'patch.mjs',
  'apply-fonts.mjs',
  'label-edges.mjs',
  'place-edge-labels.mjs',
  'frame-groups.mjs',
  'apply-components.mjs'
];

test('runtime style consumers do not duplicate preset-owned hex colors', () => {
  for (const file of consumers) {
    const source = fs.readFileSync(path.join(moduleDir, file), 'utf8');
    assert.doesNotMatch(source, /#[0-9a-fA-F]{6}\b/u, `${file} contains a preset-owned hex color literal`);
  }
});

test('frame and component renderers resolve styles through the shared preset module', () => {
  for (const file of ['frame-groups.mjs', 'apply-components.mjs']) {
    const source = fs.readFileSync(path.join(moduleDir, file), 'utf8');
    assert.match(source, /from '\.\/style-preset\.mjs'/u, `${file} must use the shared style preset resolver`);
  }
});
