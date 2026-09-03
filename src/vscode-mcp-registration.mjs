import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findExecutableOnPath } from './global-skill.mjs';

export const VSCODE_MCP_MARKER = '.vscode-mcp-registration.json';

function markerPath(targetDir) {
  return path.join(targetDir, VSCODE_MCP_MARKER);
}

function writeMarker(targetDir, value) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(markerPath(targetDir), `${JSON.stringify(value, null, 2)}\n`);
}

export function readVscodeMcpMarker(targetDir) {
  const file = markerPath(targetDir);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function standardVscodeCliCandidates({
  env = process.env,
  platform = process.platform,
  homeDir = os.homedir()
} = {}) {
  if (platform === 'darwin') {
    return [
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code',
      path.join(homeDir, 'Applications', 'Visual Studio Code.app', 'Contents', 'Resources', 'app', 'bin', 'code'),
      path.join(homeDir, 'Applications', 'Visual Studio Code - Insiders.app', 'Contents', 'Resources', 'app', 'bin', 'code')
    ];
  }
  if (platform === 'win32') {
    const roots = [
      env.LOCALAPPDATA,
      env.ProgramFiles,
      env['ProgramFiles(x86)']
    ].filter(Boolean);
    return roots.flatMap((root) => [
      path.join(root, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(root, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
      path.join(root, 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(root, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd')
    ]);
  }
  return [
    '/usr/bin/code',
    '/usr/local/bin/code',
    '/snap/bin/code',
    '/usr/bin/code-insiders',
    '/usr/local/bin/code-insiders',
    '/snap/bin/code-insiders'
  ];
}

export function resolveVscodeCli({
  env = process.env,
  platform = process.platform,
  explicitCli = null,
  homeDir = os.homedir(),
  exists = fs.existsSync
} = {}) {
  const configured = explicitCli ?? env.EXCALIDRAW_SKILL_VSCODE_CLI?.trim();
  if (configured) return configured;
  const fromPath = findExecutableOnPath('code', { env, platform })
    ?? findExecutableOnPath('code-insiders', { env, platform });
  if (fromPath) return fromPath;
  return standardVscodeCliCandidates({ env, platform, homeDir }).find((candidate) => exists(candidate)) ?? null;
}

export function registerVscodeUserMcp({
  targetDir,
  mcpServer,
  env = process.env,
  platform = process.platform,
  vscodeCli = null,
  profile = env.EXCALIDRAW_SKILL_VSCODE_PROFILE?.trim() || null,
  spawn = spawnSync,
  registeredAt = new Date().toISOString(),
  homeDir = os.homedir(),
  exists = fs.existsSync
} = {}) {
  const cliPath = resolveVscodeCli({ env, platform, explicitCli: vscodeCli, homeDir, exists });
  const payload = { name: 'excalidraw', ...mcpServer };
  if (!cliPath) {
    const result = {
      attempted: false,
      registered: false,
      status: 'cli-unavailable',
      cliPath: null,
      profile,
      payload,
      remediation: 'VS Code CLI was not found. Run `MCP: Add Server` in VS Code and choose Global, or set EXCALIDRAW_SKILL_VSCODE_CLI to the VS Code CLI path and rerun global install.'
    };
    writeMarker(targetDir, { ...result, registeredAt });
    return result;
  }

  const args = [];
  if (profile) args.push('--profile', profile);
  args.push('--add-mcp', JSON.stringify(payload));
  let child;
  try {
    child = spawn(cliPath, args, { encoding: 'utf8', stdio: 'pipe', env });
  } catch (error) {
    child = { status: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
  const registered = child.status === 0 && !child.error;
  const result = {
    attempted: true,
    registered,
    status: registered ? 'registered-via-cli' : 'registration-failed',
    cliPath,
    profile,
    payload,
    exitCode: child.status ?? 1,
    stdout: String(child.stdout ?? '').trim() || null,
    stderr: String(child.stderr ?? child.error?.message ?? '').trim() || null,
    remediation: registered
      ? null
      : 'VS Code rejected `--add-mcp`. Run `MCP: Open User Configuration` or `MCP: Add Server` and add the Excalidraw server globally.'
  };
  writeMarker(targetDir, { ...result, registeredAt });
  return result;
}

export function doctorVscodeUserMcp({
  targetDir,
  env = process.env,
  platform = process.platform,
  vscodeCli = null,
  profile = env.EXCALIDRAW_SKILL_VSCODE_PROFILE?.trim() || null,
  homeDir = os.homedir(),
  exists = fs.existsSync
} = {}) {
  const marker = readVscodeMcpMarker(targetDir);
  const cliPath = resolveVscodeCli({ env, platform, explicitCli: vscodeCli, homeDir, exists });
  const registeredAtInstall = marker?.registered === true;
  return {
    vscodeCliAvailable: Boolean(cliPath),
    vscodeCliPath: cliPath,
    vscodeProfile: profile ?? marker?.profile ?? null,
    vscodeMcpRegisteredAtInstall: registeredAtInstall,
    vscodeMcpStatus: registeredAtInstall ? 'registered-via-cli-unverified' : (marker?.status ?? 'not-attempted'),
    vscodeMcpRemediation: registeredAtInstall
      ? 'Use `MCP: List Servers` in VS Code to verify the Excalidraw server is enabled for the intended profile.'
      : (marker?.remediation ?? 'Run global install with a discoverable VS Code CLI, set EXCALIDRAW_SKILL_VSCODE_CLI explicitly, or use `MCP: Add Server` and choose Global.')
  };
}

export function removeVscodeMcpMarker(targetDir) {
  const marker = readVscodeMcpMarker(targetDir);
  fs.rmSync(markerPath(targetDir), { force: true });
  return {
    vscodeMcpRemovalRequired: marker?.registered === true,
    vscodeMcpRemovalRemediation: marker?.registered === true
      ? 'VS Code does not document a `--remove-mcp` CLI. Remove `excalidraw` with `MCP: List Servers` or `MCP: Open User Configuration` in each profile where it was installed.'
      : null
  };
}
