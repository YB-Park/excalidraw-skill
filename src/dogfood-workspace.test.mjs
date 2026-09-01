import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { installGlobalSkill } from './global-skill.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');

function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function runRuntime(runtimeEntry, cwd, args) {
  const result = spawnSync(process.execPath, [runtimeEntry, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 16 * 1024 * 1024
  });
  assert.equal(
    result.status,
    0,
    `${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  return result;
}

test('installed managed runtime completes init, build, inspect, patch, and validate in a clean workspace', (t) => {
  const home = tempDir(t, 'excalidraw-dogfood-home-');
  const workspace = tempDir(t, 'excalidraw-dogfood-workspace-');
  const targetDir = path.join(home, '.copilot', 'skills', 'excalidraw-skill');
  const runtimeDir = path.join(home, '.copilot', 'tools', 'excalidraw-skill');
  const installed = installGlobalSkill({ rootDir, targetDir, runtimeDir });
  const runtimeEntry = installed.runtimeEntry;

  runRuntime(runtimeEntry, workspace, ['init']);
  assert.equal(fs.existsSync(path.join(workspace, '.opencode', 'commands', 'excalidraw.md')), true);
  assert.equal(fs.existsSync(path.join(workspace, '.github', 'prompts', 'excalidraw.prompt.md')), true);

  const spec = JSON.parse(fs.readFileSync(
    path.join(rootDir, 'examples', 'service-flow', 'payment-flow.visual-plan.diagram.json'),
    'utf8'
  ));
  spec.outputPath = 'dogfood-payment.excalidraw';
  const specPath = path.join(workspace, 'dogfood-payment.diagram.json');
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);

  runRuntime(runtimeEntry, workspace, ['build', path.basename(specPath)]);
  const scenePath = path.join(workspace, spec.outputPath);
  assert.equal(fs.existsSync(scenePath), true);
  const editability = JSON.parse(fs.readFileSync(`${scenePath}.editability.json`, 'utf8'));
  const quality = JSON.parse(fs.readFileSync(`${scenePath}.quality.json`, 'utf8'));
  assert.equal(editability.pass, true);
  assert.equal(quality.structuralPass, true);

  runRuntime(runtimeEntry, workspace, ['inspect', spec.outputPath]);

  const patch = {
    version: '1.0',
    preserveManualLayout: true,
    operations: [
      { op: 'updateLabel', target: 'payment-service', label: 'Payment Service Dogfood' }
    ]
  };
  const patchPath = path.join(workspace, 'dogfood-payment.patch.json');
  fs.writeFileSync(patchPath, `${JSON.stringify(patch, null, 2)}\n`);
  const editedPath = 'dogfood-payment.edited.excalidraw';
  runRuntime(runtimeEntry, workspace, ['patch', spec.outputPath, path.basename(patchPath), '-o', editedPath]);
  assert.equal(fs.existsSync(path.join(workspace, editedPath)), true);

  runRuntime(runtimeEntry, workspace, ['validate', editedPath]);
  runRuntime(runtimeEntry, workspace, ['editability-report', editedPath]);
  runRuntime(runtimeEntry, workspace, ['quality-report', editedPath, path.basename(specPath)]);
});
