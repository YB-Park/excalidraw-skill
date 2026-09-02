import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(rootDir, 'bin/excalidraw-skill.mjs');

function runInit(cwd, extra = []) {
  return spawnSync(process.execPath, [bin, 'init', ...extra], { cwd, encoding: 'utf8' });
}

test('init copies checked-in managed templates and upgrade preserves unmanaged files', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-init-'));
  const first = runInit(cwd);
  assert.equal(first.status, 0, first.stderr);

  for (const relative of ['.opencode/commands/excalidraw.md', '.github/prompts/excalidraw.prompt.md']) {
    const actual = fs.readFileSync(path.join(cwd, relative), 'utf8');
    const expected = fs.readFileSync(path.join(rootDir, relative), 'utf8');
    assert.equal(actual, expected);
    assert.match(actual, /excalidraw-skill-generated:v1/);
    assert.match(actual, /review <scene\.excalidraw>/);
  }

  const unmanagedPath = path.join(cwd, '.github/prompts/excalidraw.prompt.md');
  fs.writeFileSync(unmanagedPath, '# user-owned prompt\n');
  const upgrade = runInit(cwd, ['--upgrade']);
  assert.equal(upgrade.status, 0, upgrade.stderr);
  assert.equal(fs.readFileSync(unmanagedPath, 'utf8'), '# user-owned prompt\n');
});

test('init --upgrade refreshes recognized legacy generated prompt', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-init-legacy-'));
  const target = path.join(cwd, '.github/prompts/excalidraw.prompt.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, [
    '# Excalidraw Diagram Prompt',
    'Do not call low-level `render` directly for normal generation.',
    'After generation, report the `.excalidraw` path and the quality result.'
  ].join('\n'));

  const result = runInit(cwd, ['--upgrade']);
  assert.equal(result.status, 0, result.stderr);
  const upgraded = fs.readFileSync(target, 'utf8');
  assert.match(upgraded, /excalidraw-skill-generated:v1/);
  assert.match(upgraded, /review <scene\.excalidraw>/);
});
