import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(rootDir, 'bin', 'excalidraw-skill.mjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-global-vscode-cli-'));
}

test('global install CLI actually registers MCP through the configured VS Code CLI', () => {
  const temp = tempDir();
  const copilotHome = path.join(temp, 'copilot-home');
  const logFile = path.join(temp, 'vscode-cli-args.json');
  const fakeCli = path.join(temp, 'code');
  const script = `#!/usr/bin/env node\nconst fs = require('node:fs');\nfs.writeFileSync(process.env.FAKE_VSCODE_LOG, JSON.stringify(process.argv.slice(2)));\nprocess.exit(0);\n`;
  fs.writeFileSync(fakeCli, script);
  fs.chmodSync(fakeCli, 0o755);

  const env = {
    ...process.env,
    COPILOT_HOME: copilotHome,
    EXCALIDRAW_SKILL_VSCODE_CLI: fakeCli,
    FAKE_VSCODE_LOG: logFile
  };

  try {
    const install = spawnSync(process.execPath, [bin, 'install', '--global'], {
      cwd: rootDir,
      env,
      encoding: 'utf8'
    });
    assert.equal(install.status, 0, install.stderr || install.stdout);
    const installReport = JSON.parse(install.stdout);
    assert.equal(installReport.vscodeMcp.registered, true);
    assert.equal(installReport.vscodeMcp.cliPath, fakeCli);

    const args = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    assert.equal(args[0], '--add-mcp');
    const payload = JSON.parse(args[1]);
    assert.equal(payload.name, 'excalidraw');
    assert.equal(payload.type, 'stdio');
    assert.equal(payload.command, process.execPath);
    assert.equal(payload.args.length, 1);
    assert.equal(payload.args[0], path.join(copilotHome, 'tools', 'excalidraw-skill', 'mcp', 'server.mjs'));

    const doctor = spawnSync(process.execPath, [bin, 'doctor', '--global'], {
      cwd: rootDir,
      env,
      encoding: 'utf8'
    });
    assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
    const doctorReport = JSON.parse(doctor.stdout);
    assert.equal(doctorReport.vscodeCliAvailable, true);
    assert.equal(doctorReport.vscodeMcpRegisteredAtInstall, true);
    assert.equal(doctorReport.vscodeMcpStatus, 'registered-via-cli-unverified');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
