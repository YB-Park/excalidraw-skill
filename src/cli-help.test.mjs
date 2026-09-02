import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const binPath = path.join(rootDir, 'bin', 'excalidraw-skill.mjs');
const pluralAliasPath = path.join(rootDir, 'bin', 'excalidraw-skills.mjs');

function runCli(args, entry = binPath) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: rootDir,
    encoding: 'utf8'
  });
}

test('top-level help gives build plus visual review workflow', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /New diagram, no existing \.excalidraw path/);
  assert.match(result.stdout, /node <runtimeEntry> build <spec\.json>/);
  assert.match(result.stdout, /preview <output\.excalidraw> -o <preview\.png>/);
  assert.match(result.stdout, /Visually inspect the preview/);
  assert.match(result.stdout, /Do not call patch/);
});

test('render help states JSON-only semantics and points to preview for PNG', () => {
  const result = runCli(['render', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Low-level developer scene renderer/);
  assert.match(result.stdout, /Excalidraw JSON only/);
  assert.match(result.stdout, /use preview/i);
  assert.doesNotMatch(result.stderr, /ENOENT|no such file/i);
});

test('preview help describes portable PNG visual review', () => {
  const result = runCli(['preview', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /preview <scene\.excalidraw>/);
  assert.match(result.stdout, /portable PNG/i);
  assert.match(result.stdout, /not pixel-identical/i);
});

test('bare patch fails with edit-only guidance', () => {
  const result = runCli(['patch']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Patch is only for editing an existing \.excalidraw scene/);
  assert.match(result.stderr, /Usage: excalidraw-skill patch <scene\.excalidraw> <patch\.json>/);
});

test('pluralized CLI filename remains a compatibility alias', () => {
  const result = runCli(['--help'], pluralAliasPath);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /compatibility alias/);
  assert.match(result.stdout, /Usage: excalidraw-skill <command>/);
});
