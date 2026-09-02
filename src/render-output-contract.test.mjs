import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertRenderOutputPath } from './render.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const binPath = path.join(rootDir, 'bin', 'excalidraw-skill.mjs');

test('low-level render accepts only .excalidraw outputs', () => {
  assert.doesNotThrow(() => assertRenderOutputPath('diagram.excalidraw'));
  assert.throws(() => assertRenderOutputPath('diagram.png'), /render writes Excalidraw JSON only/);
});

test('CLI render refuses to create a JSON file disguised as PNG', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-render-contract-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const specPath = path.join(dir, 'spec.json');
  const outputPath = path.join(dir, 'broken.png');
  fs.writeFileSync(specPath, JSON.stringify({
    diagramType: 'service-flow',
    nodes: [{ semanticId: 'a', label: 'A' }],
    edges: []
  }));

  const result = spawnSync(process.execPath, [binPath, 'render', specPath, '-o', outputPath], {
    cwd: dir,
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(outputPath), false);
  assert.match(result.stderr, /preview <scene\.excalidraw> -o preview\.png/);
});
