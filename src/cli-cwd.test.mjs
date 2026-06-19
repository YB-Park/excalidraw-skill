import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binPath = path.join(rootDir, 'bin', 'excalidraw-skill.mjs');

test('global CLI keeps the invoking workspace as cwd', (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-skill-cwd-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [binPath, 'init'], {
    cwd: workspace,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(workspace, '.opencode', 'commands', 'excalidraw.md')), true);
  assert.equal(fs.existsSync(path.join(workspace, '.github', 'prompts', 'excalidraw.prompt.md')), true);
});
