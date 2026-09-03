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

function readJsonObject(file) {
  if (!fs.existsSync(file)) return {};
  const source = fs.readFileSync(file, 'utf8').trim();
  if (!source) return {};
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in VS Code MCP configuration: ${file}: ${detail}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected JSON object: ${file}`);
  }
  return value;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
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
    const roots = [env.LOCALAPPDATA, env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean);
    return roots.flatMap((root) => [
      path.join(root, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(root, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
      path.join(root, 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(root, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd')
    ]);
  }
  return [
    '/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code',
    '/usr/bin/code-insiders', '/usr/local/bin/code-insiders', '/snap/bin/code-insiders'
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

export function resolveVscodeUserMcpConfig({
  env = process.env,
  platform = process.platform,
  homeDir = os.homedir(),
  vscodeCli = null,
  profile = env.EXCALIDRAW_SKILL_VSCODE_PROFILE?.trim() || null
} = {}) {
  const explicit = env.EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG?.trim();
  if (explicit) return path.resolve(explicit);
  if (profile) return null;
  const insiders = String(vscodeCli ?? env.EXCALIDRAW_SKILL_VSCODE_CLI ?? '').includes('insider');
  const productDir = insiders ? 'Code - Insiders' : 'Code';
  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Application Support', productDir, 'User', 'mcp.json');
  if (platform === 'win32') {
    const appData = env.APPDATA?.trim();
    return appData ? path.join(appData, productDir, 'User', 'mcp.json') : null;
  }
  const configHome = env.XDG_CONFIG_HOME?.trim() || path.join(homeDir, '.config');
  return path.join(configHome, productDir, 'User', 'mcp.json');
}

function cliSupportsAddMcp(cliPath, { spawn = spawnSync, env = process.env } = {}) {
  if (!cliPath) return false;
  try {
    const result = spawn(cliPath, ['--help'], { encoding: 'utf8', stdio: 'pipe', env });
    const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    return result.status === 0 && text.includes('--add-mcp');
  } catch {
    return false;
  }
}

function writeUserMcpConfig(configPath, mcpServer, { force = false } = {}) {
  const config = readJsonObject(configPath);
  const servers = config.servers && typeof config.servers === 'object' && !Array.isArray(config.servers)
    ? { ...config.servers }
    : {};
  if (servers.excalidraw && JSON.stringify(servers.excalidraw) !== JSON.stringify(mcpServer) && !force) {
    throw new Error(`Refusing to replace unmanaged VS Code MCP server: ${configPath}#servers.excalidraw`);
  }
  servers.excalidraw = mcpServer;
  writeJson(configPath, { ...config, servers });
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
  exists = fs.existsSync,
  force = false
} = {}) {
  const cliPath = resolveVscodeCli({ env, platform, explicitCli: vscodeCli, homeDir, exists });
  const configPath = resolveVscodeUserMcpConfig({ env, platform, homeDir, vscodeCli: cliPath, profile });
  const payload = { name: 'excalidraw', ...mcpServer };

  let result;
  if (cliSupportsAddMcp(cliPath, { spawn, env })) {
    const args = [];
    if (profile) args.push('--profile', profile);
    args.push('--add-mcp', JSON.stringify(payload));
    const child = spawn(cliPath, args, { encoding: 'utf8', stdio: 'pipe', env });
    const registered = child.status === 0 && !child.error;
    result = {
      attempted: true,
      registered,
      method: 'cli',
      status: registered ? 'registered-via-cli' : 'registration-failed',
      cliPath,
      configPath,
      profile,
      payload,
      exitCode: child.status ?? 1,
      stdout: String(child.stdout ?? '').trim() || null,
      stderr: String(child.stderr ?? child.error?.message ?? '').trim() || null,
      remediation: registered ? null : 'VS Code rejected `--add-mcp`; use `MCP: Open User Configuration` to inspect the user profile MCP configuration.'
    };
  } else if (configPath) {
    writeUserMcpConfig(configPath, mcpServer, { force });
    result = {
      attempted: true,
      registered: true,
      method: 'config-file',
      status: 'registered-via-user-config',
      cliPath,
      configPath,
      profile,
      payload,
      remediation: null
    };
  } else {
    result = {
      attempted: false,
      registered: false,
      method: null,
      status: 'profile-config-unresolved',
      cliPath,
      configPath: null,
      profile,
      payload,
      remediation: 'The selected VS Code profile cannot be mapped safely. Set EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG to the mcp.json opened by `MCP: Open User Configuration`, or use `MCP: Add Server` and choose Global.'
    };
  }
  writeMarker(targetDir, { ...result, registeredAt, mcpServer });
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
  const configPath = marker?.configPath ?? resolveVscodeUserMcpConfig({ env, platform, homeDir, vscodeCli: cliPath, profile });
  let liveMatch = false;
  if (configPath && marker?.mcpServer) {
    try {
      liveMatch = JSON.stringify(readJsonObject(configPath).servers?.excalidraw ?? null) === JSON.stringify(marker.mcpServer);
    } catch {
      liveMatch = false;
    }
  }
  const registeredAtInstall = marker?.registered === true;
  return {
    vscodeCliAvailable: Boolean(cliPath),
    vscodeCliPath: cliPath,
    vscodeProfile: profile ?? marker?.profile ?? null,
    vscodeMcpConfigPath: configPath,
    vscodeMcpRegisteredAtInstall: registeredAtInstall,
    vscodeMcpLiveConfigMatch: liveMatch,
    vscodeMcpStatus: liveMatch ? 'registered-and-verified' : (marker?.status ?? 'not-attempted'),
    vscodeMcpRemediation: liveMatch
      ? null
      : (marker?.remediation ?? 'Run global install again, or use `MCP: Open User Configuration` and add the Excalidraw server globally.')
  };
}

export function removeVscodeMcpMarker(targetDir) {
  const marker = readVscodeMcpMarker(targetDir);
  let removedConfig = false;
  if (marker?.method === 'config-file' && marker.configPath && marker.mcpServer && fs.existsSync(marker.configPath)) {
    try {
      const config = readJsonObject(marker.configPath);
      const current = config.servers?.excalidraw;
      if (JSON.stringify(current) === JSON.stringify(marker.mcpServer)) {
        const servers = { ...(config.servers ?? {}) };
        delete servers.excalidraw;
        writeJson(marker.configPath, { ...config, servers });
        removedConfig = true;
      }
    } catch {
      removedConfig = false;
    }
  }
  fs.rmSync(markerPath(targetDir), { force: true });
  return {
    vscodeMcpRemovalRequired: marker?.method === 'cli' && marker?.registered === true,
    vscodeMcpConfigRemoved: removedConfig,
    vscodeMcpRemovalRemediation: marker?.method === 'cli' && marker?.registered === true
      ? 'Remove `excalidraw` with `MCP: List Servers` or `MCP: Open User Configuration` for the profile where it was installed.'
      : null
  };
}
