import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  doctorVscodeUserMcp,
  readVscodeMcpMarker,
  registerVscodeUserMcp,
  removeVscodeMcpMarker,
  resolveVscodeCli,
  standardVscodeCliCandidates
} from './vscode-mcp-registration.mjs';

const server = {
  type: 'stdio',
  command: '/usr/bin/node',
  args: ['/tmp/excalidraw-runtime/mcp/server.mjs']
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-vscode-mcp-'));
}

test('registers Excalidraw MCP in VS Code user profile with exact --add-mcp payload', () => {
  const targetDir = tempDir();
  const calls = [];
  try {
    const result = registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      vscodeCli: '/fake/code',
      registeredAt: '2026-09-03T00:00:00.000Z',
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0, stdout: 'MCP server added', stderr: '' };
      }
    });
    assert.equal(result.registered, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, '/fake/code');
    assert.deepEqual(calls[0].args.slice(0, 1), ['--add-mcp']);
    assert.deepEqual(JSON.parse(calls[0].args[1]), { name: 'excalidraw', ...server });
    const marker = readVscodeMcpMarker(targetDir);
    assert.equal(marker.registered, true);
    assert.equal(marker.registeredAt, '2026-09-03T00:00:00.000Z');
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test('supports explicit VS Code profile without guessing profile file paths', () => {
  const targetDir = tempDir();
  const calls = [];
  try {
    registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      vscodeCli: '/fake/code',
      profile: 'Work',
      spawn(command, args) {
        calls.push({ command, args });
        return { status: 0, stdout: '', stderr: '' };
      }
    });
    assert.deepEqual(calls[0].args.slice(0, 3), ['--profile', 'Work', '--add-mcp']);
    assert.deepEqual(JSON.parse(calls[0].args[3]), { name: 'excalidraw', ...server });
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test('discovers macOS desktop VS Code CLI even when code is not on PATH', () => {
  const expected = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
  const result = resolveVscodeCli({
    env: { PATH: '' },
    platform: 'darwin',
    homeDir: '/Users/tester',
    exists(candidate) { return candidate === expected; }
  });
  assert.equal(result, expected);
  assert.equal(standardVscodeCliCandidates({ platform: 'darwin', homeDir: '/Users/tester' }).includes(expected), true);
});

test('discovers Windows user install VS Code CLI even when code is not on PATH', () => {
  const env = { PATH: '', LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' };
  const expected = path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd');
  const result = resolveVscodeCli({
    env,
    platform: 'win32',
    homeDir: 'C:\\Users\\tester',
    exists(candidate) { return candidate === expected; }
  });
  assert.equal(result, expected);
});

test('explicit VS Code CLI override wins over PATH and fallback discovery', () => {
  const result = resolveVscodeCli({
    env: { PATH: '', EXCALIDRAW_SKILL_VSCODE_CLI: '/custom/code' },
    platform: 'darwin',
    exists() { return true; }
  });
  assert.equal(result, '/custom/code');
});

test('missing VS Code CLI is non-fatal and doctor gives explicit remediation', () => {
  const targetDir = tempDir();
  try {
    const result = registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      env: { PATH: '' },
      platform: 'linux',
      exists() { return false; }
    });
    assert.equal(result.attempted, false);
    assert.equal(result.registered, false);
    assert.equal(result.status, 'cli-unavailable');
    const report = doctorVscodeUserMcp({ targetDir, env: { PATH: '' }, platform: 'linux', exists() { return false; } });
    assert.equal(report.vscodeCliAvailable, false);
    assert.equal(report.vscodeMcpRegisteredAtInstall, false);
    assert.match(report.vscodeMcpRemediation, /MCP: Add Server/);
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test('doctor distinguishes successful registration history from live profile verification', () => {
  const targetDir = tempDir();
  try {
    registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      vscodeCli: '/fake/code',
      spawn() { return { status: 0, stdout: '', stderr: '' }; }
    });
    const report = doctorVscodeUserMcp({ targetDir, vscodeCli: '/fake/code' });
    assert.equal(report.vscodeMcpRegisteredAtInstall, true);
    assert.equal(report.vscodeMcpStatus, 'registered-via-cli-unverified');
    assert.match(report.vscodeMcpRemediation, /MCP: List Servers/);
    const removed = removeVscodeMcpMarker(targetDir);
    assert.equal(removed.vscodeMcpRemovalRequired, true);
    assert.match(removed.vscodeMcpRemovalRemediation, /does not document a `--remove-mcp` CLI/);
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});
