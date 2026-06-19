import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INSTALL_MARKER,
  doctorGlobalSkill,
  installGlobalSkill,
  resolveGlobalSkillDir,
  uninstallGlobalSkill
} from './global-skill.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-skill-global-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function normalizeMarkdown(text) {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')}\n`;
}

test('installs a self-contained global skill bundle', (t) => {
  const targetDir = path.join(tempDir(t), '.copilot', 'skills', 'excalidraw-skill');
  const result = installGlobalSkill({ rootDir, targetDir, installedAt: '2026-01-01T00:00:00.000Z' });
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
  const report = doctorGlobalSkill({ targetDir, checkCli: false });
  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);
});

test('reinstall atomically replaces the managed bundle', (t) => {
  const targetDir = path.join(tempDir(t), 'skill');
  installGlobalSkill({ rootDir, targetDir });
  fs.writeFileSync(path.join(targetDir, 'stale-file.txt'), 'stale');
  const result = installGlobalSkill({ rootDir, targetDir });
  assert.equal(result.replaced, true);
  assert.equal(fs.existsSync(path.join(targetDir, 'stale-file.txt')), false);
});

test('does not overwrite an unmanaged directory without force', (t) => {
  const targetDir = path.join(tempDir(t), 'skill');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'user-file.txt'), 'keep');
  assert.throws(() => installGlobalSkill({ rootDir, targetDir }), /unmanaged directory/);
  installGlobalSkill({ rootDir, targetDir, force: true });
  assert.equal(fs.existsSync(path.join(targetDir, 'user-file.txt')), false);
});

test('uninstalls only managed installs by default', (t) => {
  const targetDir = path.join(tempDir(t), 'skill');
  installGlobalSkill({ rootDir, targetDir });
  assert.equal(uninstallGlobalSkill({ targetDir }).removed, true);
  assert.equal(uninstallGlobalSkill({ targetDir }).removed, false);
});

test('resolves COPILOT_HOME and explicit target overrides', () => {
  assert.equal(
    resolveGlobalSkillDir({ env: { COPILOT_HOME: '/tmp/copilot-home' }, homeDir: '/unused' }),
    path.resolve('/tmp/copilot-home/skills/excalidraw-skill')
  );
  assert.equal(
    resolveGlobalSkillDir({ env: { EXCALIDRAW_SKILL_GLOBAL_DIR: '/tmp/custom-skill' }, homeDir: '/unused' }),
    path.resolve('/tmp/custom-skill')
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
