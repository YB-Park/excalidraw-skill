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

test('global install works when installed VS Code CLI has no --add-mcp option', () => {
  const temp = tempDir();
  const copilotHome = path.join(temp, 'copilot-home');
  const configPath = path.join(temp, 'Code', 'User', 'mcp.json');
  const fakeCli = path.join(temp, 'code');
  const script = `#!/usr/bin/env node\nif (process.argv[2] === '--help') { console.log('Visual Studio Code CLI help without add mcp'); process.exit(0); }\nconsole.error('unexpected args', process.argv.slice(2)); process.exit(2);\n`;
  fs.writeFileSync(fakeCli, script);
  fs.chmodSync(fakeCli, 0o755);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ servers: { keep: { type: 'http', url: 'https://example.test' } } }));

  const env = {
    ...process.env,
    COPILOT_HOME: copilotHome,
    EXCALIDRAW_SKILL_VSCODE_CLI: fakeCli,
    EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG: configPath
  };

  try {
    const install = spawnSync(process.execPath, [bin, 'install', '--global'], { cwd: rootDir, env, encoding: 'utf8' });
    assert.equal(install.status, 0, install.stderr || install.stdout);
    const installReport = JSON.parse(install.stdout);
    assert.equal(installReport.vscodeMcp.registered, true);
    assert.equal(installReport.vscodeMcp.method, 'config-file');
    assert.equal(installReport.vscodeMcp.status, 'registered-via-user-config');
    assert.equal(installReport.vscodeMcp.configPath, configPath);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.servers.keep.url, 'https://example.test');
    assert.equal(config.servers.excalidraw.type, 'stdio');
    assert.equal(config.servers.excalidraw.command, process.execPath);
    assert.deepEqual(config.servers.excalidraw.args, [path.join(copilotHome, 'tools', 'excalidraw-skill', 'mcp', 'server.mjs')]);

    const doctor = spawnSync(process.execPath, [bin, 'doctor', '--global'], { cwd: rootDir, env, encoding: 'utf8' });
    assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
    const doctorReport = JSON.parse(doctor.stdout);
    assert.equal(doctorReport.vscodeMcpRegisteredAtInstall, true);
    assert.equal(doctorReport.vscodeMcpLiveConfigMatch, true);
    assert.equal(doctorReport.vscodeMcpStatus, 'registered-and-verified');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
