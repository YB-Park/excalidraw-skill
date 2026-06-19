import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INSTALL_MARKER,
  RUNTIME_MARKER,
  doctorGlobalSkill,
  installGlobalSkill,
  resolveGlobalRuntimeDir,
  resolveGlobalSkillDir,
  uninstallGlobalSkill
} from './global-skill.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-skill-global-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function targets(t) {
  const home = tempDir(t);
  return {
    home,
    targetDir: path.join(home, '.copilot', 'skills', 'excalidraw-skill'),
    runtimeDir: path.join(home, '.copilot', 'tools', 'excalidraw-skill')
  };
}

function normalizeMarkdown(text) {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')}\n`;
}

test('installs a self-contained global skill and runtime', (t) => {
  const { targetDir, runtimeDir } = targets(t);
  const result = installGlobalSkill({
    rootDir,
    targetDir,
    runtimeDir,
    installedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(result.installed, true);
  assert.equal(result.replaced, false);
  for (const relative of [
    'SKILL.md',
    'guides/create.md',
    'contracts/diagram-spec.md',
    'diagram-types/sequence.md',
    'docs/DIAGRAM_TYPES.md',
    'docs/QUALITY_CRITERIA.md',
    INSTALL_MARKER
  ]) {
    assert.equal(fs.existsSync(path.join(targetDir, relative)), true, relative);
  }
  for (const relative of [
    'bin/excalidraw-skill.mjs',
    'src/build.mjs',
    'src/global-skill.mjs',
    'package.json',
    RUNTIME_MARKER
  ]) {
    assert.equal(fs.existsSync(path.join(runtimeDir, relative)), true, relative);
  }
  const marker = JSON.parse(fs.readFileSync(path.join(targetDir, INSTALL_MARKER), 'utf8'));
  assert.equal(marker.runtimeDir, runtimeDir);
  assert.equal(marker.runtimeEntry, path.join(runtimeDir, 'bin', 'excalidraw-skill.mjs'));

  const report = doctorGlobalSkill({ targetDir, runtimeDir, checkCli: false });
  assert.equal(report.ok, true);
  assert.equal(report.skillOk, true);
  assert.equal(report.runtimeOk, true);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.runtimeMissing, []);
});

test('reinstall atomically replaces both managed directories', (t) => {
  const { targetDir, runtimeDir } = targets(t);
  installGlobalSkill({ rootDir, targetDir, runtimeDir });
  fs.writeFileSync(path.join(targetDir, 'stale-skill.txt'), 'stale');
  fs.writeFileSync(path.join(runtimeDir, 'stale-runtime.txt'), 'stale');
  const result = installGlobalSkill({ rootDir, targetDir, runtimeDir });
  assert.equal(result.replaced, true);
  assert.equal(result.replacedSkill, true);
  assert.equal(result.replacedRuntime, true);
  assert.equal(fs.existsSync(path.join(targetDir, 'stale-skill.txt')), false);
  assert.equal(fs.existsSync(path.join(runtimeDir, 'stale-runtime.txt')), false);
});

test('does not overwrite unmanaged skill or runtime directories without force', (t) => {
  const { targetDir, runtimeDir } = targets(t);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'user-file.txt'), 'keep');
  assert.throws(
    () => installGlobalSkill({ rootDir, targetDir, runtimeDir }),
    /unmanaged directory/
  );
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, 'user-runtime.txt'), 'keep');
  assert.throws(
    () => installGlobalSkill({ rootDir, targetDir, runtimeDir }),
    /unmanaged directory/
  );
  installGlobalSkill({ rootDir, targetDir, runtimeDir, force: true });
  assert.equal(fs.existsSync(path.join(runtimeDir, 'user-runtime.txt')), false);
});

test('uninstalls both managed directories by default', (t) => {
  const { targetDir, runtimeDir } = targets(t);
  installGlobalSkill({ rootDir, targetDir, runtimeDir });
  const removed = uninstallGlobalSkill({ targetDir, runtimeDir });
  assert.equal(removed.removed, true);
  assert.equal(removed.removedSkill, true);
  assert.equal(removed.removedRuntime, true);
  assert.equal(fs.existsSync(targetDir), false);
  assert.equal(fs.existsSync(runtimeDir), false);
  assert.equal(uninstallGlobalSkill({ targetDir, runtimeDir }).removed, false);
});

test('resolves COPILOT_HOME and explicit target overrides', () => {
  const options = { env: { COPILOT_HOME: '/tmp/copilot-home' }, homeDir: '/unused' };
  assert.equal(
    resolveGlobalSkillDir(options),
    path.resolve('/tmp/copilot-home/skills/excalidraw-skill')
  );
  assert.equal(
    resolveGlobalRuntimeDir(options),
    path.resolve('/tmp/copilot-home/tools/excalidraw-skill')
  );
  assert.equal(
    resolveGlobalSkillDir({ env: { EXCALIDRAW_SKILL_GLOBAL_DIR: '/tmp/custom-skill' }, homeDir: '/unused' }),
    path.resolve('/tmp/custom-skill')
  );
  assert.equal(
    resolveGlobalRuntimeDir({ env: { EXCALIDRAW_SKILL_RUNTIME_DIR: '/tmp/custom-runtime' }, homeDir: '/unused' }),
    path.resolve('/tmp/custom-runtime')
  );
});

test('bundled docs stay synchronized with repository docs', () => {
  for (const name of ['DIAGRAM_TYPES.md', 'QUALITY_CRITERIA.md']) {
    const bundled = fs.readFileSync(path.join(rootDir, 'skills', 'excalidraw-skill', 'docs', name), 'utf8');
    const repository = fs.readFileSync(path.join(rootDir, 'docs', name), 'utf8');
    assert.equal(
      normalizeMarkdown(bundled),
      normalizeMarkdown(repository),
      `${name} content differs between repository docs and the bundled skill`
    );
  }
});
