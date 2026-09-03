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
  resolveVscodeMcpScope,
  resolveVscodeUserMcpConfig,
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

test('uses --add-mcp only when the installed VS Code CLI advertises it', () => {
  const targetDir = tempDir();
  const calls = [];
  try {
    const result = registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      vscodeCli: '/fake/code',
      spawn(command, args) {
        calls.push({ command, args });
        if (args[0] === '--help') return { status: 0, stdout: 'usage\n  --add-mcp <json>', stderr: '' };
        return { status: 0, stdout: 'added', stderr: '' };
      }
    });
    assert.equal(result.registered, true);
    assert.equal(result.method, 'cli');
    assert.deepEqual(calls[0].args, ['--help']);
    assert.equal(calls[1].args[0], '--add-mcp');
    assert.deepEqual(JSON.parse(calls[1].args[1]), { name: 'excalidraw', ...server });
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test('falls back to the VS Code user mcp.json when CLI lacks --add-mcp', () => {
  const temp = tempDir();
  const targetDir = path.join(temp, 'skill');
  const configPath = path.join(temp, 'mcp.json');
  fs.writeFileSync(configPath, JSON.stringify({ servers: { existing: { type: 'http', url: 'https://example.test' } } }));
  try {
    const result = registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      vscodeCli: '/fake/code',
      env: { EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG: configPath },
      spawn(_command, args) {
        assert.deepEqual(args, ['--help']);
        return { status: 0, stdout: 'usage without add mcp', stderr: '' };
      }
    });
    assert.equal(result.registered, true);
    assert.equal(result.method, 'config-file');
    assert.equal(result.status, 'registered-via-user-config');
    assert.equal(result.scope, 'explicit');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(config.servers.excalidraw, server);
    assert.equal(config.servers.existing.url, 'https://example.test');

    const report = doctorVscodeUserMcp({
      targetDir,
      vscodeCli: '/fake/code',
      env: { EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG: configPath }
    });
    assert.equal(report.vscodeMcpRegisteredAtInstall, true);
    assert.equal(report.vscodeMcpLiveConfigMatch, true);
    assert.equal(report.vscodeMcpStatus, 'registered-and-verified');
    assert.equal(report.vscodeMcpScope, 'explicit');

    const removed = removeVscodeMcpMarker(targetDir);
    assert.equal(removed.vscodeMcpConfigRemoved, true);
    const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(after.servers.excalidraw, undefined);
    assert.equal(after.servers.existing.url, 'https://example.test');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('treats empty or whitespace VS Code mcp.json as an empty configuration', () => {
  for (const initial of ['', '   \n\t']) {
    const temp = tempDir();
    const targetDir = path.join(temp, 'skill');
    const configPath = path.join(temp, 'mcp.json');
    fs.writeFileSync(configPath, initial);
    try {
      const result = registerVscodeUserMcp({
        targetDir,
        mcpServer: server,
        vscodeCli: '/fake/code',
        env: { EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG: configPath },
        spawn() { return { status: 0, stdout: 'usage without add mcp', stderr: '' }; }
      });
      assert.equal(result.registered, true);
      assert.equal(result.method, 'config-file');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.deepEqual(config, { servers: { excalidraw: server } });
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
});

test('does not overwrite malformed non-empty VS Code mcp.json', () => {
  const temp = tempDir();
  const targetDir = path.join(temp, 'skill');
  const configPath = path.join(temp, 'mcp.json');
  const malformed = '{\n  "servers":';
  fs.writeFileSync(configPath, malformed);
  try {
    assert.throws(() => registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      vscodeCli: '/fake/code',
      env: { EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG: configPath },
      spawn() { return { status: 0, stdout: 'usage without add mcp', stderr: '' }; }
    }), new RegExp(`Invalid JSON in VS Code MCP configuration: ${configPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.equal(fs.readFileSync(configPath, 'utf8'), malformed);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('VS Code Server remote sessions resolve to remote-user mcp.json', () => {
  const homeDir = '/home/tester';
  const serverRoot = path.join(homeDir, '.vscode-server');
  const expected = path.join(serverRoot, 'data', 'User', 'mcp.json');
  const env = {
    SSH_CONNECTION: '10.0.0.1 12345 10.0.0.2 22',
    VSCODE_IPC_HOOK_CLI: path.join(serverRoot, 'data', 'User', 'globalStorage', 'ipc.sock')
  };
  const exists = (candidate) => candidate === serverRoot;
  assert.equal(resolveVscodeMcpScope({ platform: 'linux', homeDir, env, exists }), 'remote-user');
  assert.equal(resolveVscodeUserMcpConfig({ platform: 'linux', homeDir, env, exists }), expected);
});

test('VS Code Server Insiders remote sessions resolve to insiders remote-user mcp.json', () => {
  const homeDir = '/home/tester';
  const serverRoot = path.join(homeDir, '.vscode-server-insiders');
  const expected = path.join(serverRoot, 'data', 'User', 'mcp.json');
  const env = {
    SSH_CLIENT: '10.0.0.1 12345 22',
    VSCODE_IPC_HOOK_CLI: path.join(serverRoot, 'data', 'User', 'ipc.sock')
  };
  const exists = (candidate) => candidate === serverRoot;
  assert.equal(resolveVscodeMcpScope({ platform: 'linux', homeDir, env, exists }), 'remote-user');
  assert.equal(resolveVscodeUserMcpConfig({ platform: 'linux', homeDir, env, exists }), expected);
});

test('Linux desktop keeps local user config when no remote session signal is present', () => {
  const homeDir = '/home/tester';
  const serverRoot = path.join(homeDir, '.vscode-server');
  const exists = (candidate) => candidate === serverRoot;
  assert.equal(resolveVscodeMcpScope({ platform: 'linux', homeDir, env: {}, exists }), 'user');
  assert.equal(
    resolveVscodeUserMcpConfig({ platform: 'linux', homeDir, env: {}, exists }),
    path.join(homeDir, '.config', 'Code', 'User', 'mcp.json')
  );
});

test('global registration writes and doctor verifies the remote-user config', () => {
  const temp = tempDir();
  const homeDir = path.join(temp, 'home');
  const serverRoot = path.join(homeDir, '.vscode-server');
  const configPath = path.join(serverRoot, 'data', 'User', 'mcp.json');
  const targetDir = path.join(temp, 'skill');
  fs.mkdirSync(serverRoot, { recursive: true });
  const env = { SSH_CONNECTION: '1 2 3 4' };
  try {
    const result = registerVscodeUserMcp({
      targetDir,
      mcpServer: server,
      platform: 'linux',
      homeDir,
      env,
      exists: fs.existsSync,
      vscodeCli: '/fake/code',
      spawn() { return { status: 0, stdout: 'usage without add mcp', stderr: '' }; }
    });
    assert.equal(result.registered, true);
    assert.equal(result.method, 'config-file');
    assert.equal(result.scope, 'remote-user');
    assert.equal(result.configPath, configPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')).servers.excalidraw, server);

    const report = doctorVscodeUserMcp({
      targetDir,
      platform: 'linux',
      homeDir,
      env,
      exists: fs.existsSync,
      vscodeCli: '/fake/code'
    });
    assert.equal(report.vscodeMcpScope, 'remote-user');
    assert.equal(report.vscodeMcpConfigPath, configPath);
    assert.equal(report.vscodeMcpLiveConfigMatch, true);
    assert.equal(report.vscodeMcpStatus, 'registered-and-verified');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('default profile paths resolve to VS Code user mcp.json', () => {
  assert.equal(
    resolveVscodeUserMcpConfig({ platform: 'darwin', homeDir: '/Users/tester', env: {} }),
    path.join('/Users/tester', 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
  );
  assert.equal(
    resolveVscodeUserMcpConfig({ platform: 'win32', homeDir: 'C:\\Users\\tester', env: { APPDATA: 'C:\\Users\\tester\\AppData\\Roaming' } }),
    path.join('C:\\Users\\tester\\AppData\\Roaming', 'Code', 'User', 'mcp.json')
  );
  assert.equal(
    resolveVscodeUserMcpConfig({ platform: 'linux', homeDir: '/home/tester', env: {} }),
    path.join('/home/tester', '.config', 'Code', 'User', 'mcp.json')
  );
});

test('named profiles are not guessed when --add-mcp is unavailable', () => {
  assert.equal(resolveVscodeUserMcpConfig({ platform: 'darwin', homeDir: '/Users/tester', env: {}, profile: 'Work' }), null);
  assert.equal(resolveVscodeMcpScope({ platform: 'darwin', homeDir: '/Users/tester', env: {}, profile: 'Work' }), 'profile-unresolved');
});

test('discovers macOS desktop VS Code CLI even when code is not on PATH', () => {
  const expected = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
  const result = resolveVscodeCli({ env: { PATH: '' }, platform: 'darwin', homeDir: '/Users/tester', exists(candidate) { return candidate === expected; } });
  assert.equal(result, expected);
  assert.equal(standardVscodeCliCandidates({ platform: 'darwin', homeDir: '/Users/tester' }).includes(expected), true);
});

test('discovers Windows user install VS Code CLI even when code is not on PATH', () => {
  const env = { PATH: '', LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' };
  const expected = path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd');
  const result = resolveVscodeCli({ env, platform: 'win32', homeDir: 'C:\\Users\\tester', exists(candidate) { return candidate === expected; } });
  assert.equal(result, expected);
});

test('explicit VS Code CLI override wins over PATH and fallback discovery', () => {
  const result = resolveVscodeCli({ env: { PATH: '', EXCALIDRAW_SKILL_VSCODE_CLI: '/custom/code' }, platform: 'darwin', exists() { return true; } });
  assert.equal(result, '/custom/code');
});
