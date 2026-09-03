import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(moduleDir, '..');
export const INSTALL_MARKER = '.excalidraw-skill-install.json';
export const RUNTIME_MARKER = '.excalidraw-skill-runtime.json';
export const AGENTS_MARKER = '.excalidraw-skill-agents.json';
export const MCP_CONFIG = 'mcp-config.json';
export const MANAGED_MCP_SERVER = 'excalidraw';

const REQUIRED_FILES = Object.freeze([
  'SKILL.md',
  'guides/create.md',
  'guides/edit.md',
  'guides/style.md',
  'guides/visual-review.md',
  'catalog/shapes.index.json',
  'contracts/diagram-spec.md',
  'contracts/visual-plan.md',
  'contracts/quality-report.md',
  'contracts/sequence-spec.md',
  'diagram-types/system-architecture.md',
  'diagram-types/module-architecture.md',
  'diagram-types/flow.md',
  'diagram-types/sequence.md',
  'docs/DIAGRAM_TYPES.md',
  'docs/QUALITY_CRITERIA.md'
]);

const RUNTIME_ENTRIES = Object.freeze([
  'bin',
  'src',
  'assets',
  'skills',
  '.opencode',
  '.github/prompts',
  'mcp',
  'node_modules',
  'package.json'
]);

const AGENT_FILES = Object.freeze([
  'excalidraw-designer.agent.md',
  'excalidraw-planner.agent.md',
  'excalidraw-critic.agent.md'
]);

const REQUIRED_RUNTIME_FILES = Object.freeze([
  'bin/excalidraw-skill.mjs',
  'src/build.mjs',
  'src/review.mjs',
  'src/export-preview-png.mjs',
  'src/global-skill.mjs',
  'src/init.mjs',
  'node_modules/@resvg/resvg-js/index.js',
  'skills/excalidraw-skill/SKILL.md',
  'package.json'
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function packageVersion(rootDir) {
  try {
    return readJson(path.join(rootDir, 'package.json')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function missingFiles(dir, required) {
  return required.filter((relative) => !fs.existsSync(path.join(dir, relative)));
}

function missingBundleFiles(dir) {
  return missingFiles(dir, REQUIRED_FILES);
}

function missingRuntimeFiles(dir) {
  return missingFiles(dir, REQUIRED_RUNTIME_FILES);
}

function readMarker(targetDir, markerName = INSTALL_MARKER) {
  const markerPath = path.join(targetDir, markerName);
  if (!fs.existsSync(markerPath)) return null;
  try {
    return readJson(markerPath);
  } catch {
    return null;
  }
}

function managedInstall(targetDir, markerName = INSTALL_MARKER) {
  return readMarker(targetDir, markerName)?.managedBy === 'excalidraw-skill';
}

function removeIfExists(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copilotHome({ env = process.env, homeDir = os.homedir() } = {}) {
  return env.COPILOT_HOME?.trim()
    ? path.resolve(env.COPILOT_HOME)
    : path.join(homeDir, '.copilot');
}

export function resolveGlobalSkillDir(options = {}) {
  const override = options.env?.EXCALIDRAW_SKILL_GLOBAL_DIR?.trim()
    ?? process.env.EXCALIDRAW_SKILL_GLOBAL_DIR?.trim();
  if (override) return path.resolve(override);
  return path.join(copilotHome(options), 'skills', 'excalidraw-skill');
}

export function resolveGlobalRuntimeDir(options = {}) {
  const override = options.env?.EXCALIDRAW_SKILL_RUNTIME_DIR?.trim()
    ?? process.env.EXCALIDRAW_SKILL_RUNTIME_DIR?.trim();
  if (override) return path.resolve(override);
  return path.join(copilotHome(options), 'tools', 'excalidraw-skill');
}

export function resolveGlobalAgentsDir(options = {}) {
  return path.join(copilotHome(options), 'agents');
}

export function resolveGlobalMcpConfig(options = {}) {
  return path.join(copilotHome(options), MCP_CONFIG);
}

export function findExecutableOnPath(name, { env = process.env, platform = process.platform } = {}) {
  const directories = String(env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const extensions = platform === 'win32'
    ? String(env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];
  const names = platform === 'win32' && path.extname(name)
    ? [name]
    : extensions.map((extension) => `${name}${extension}`);

  for (const directory of directories) {
    for (const candidateName of names) {
      const candidate = path.join(directory, candidateName);
      try {
        fs.accessSync(candidate, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
        return candidate;
      } catch {
        // Keep searching.
      }
    }
  }
  return null;
}

function copyRuntime(rootDir, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of RUNTIME_ENTRIES) {
    const source = path.join(rootDir, entry);
    if (!fs.existsSync(source)) continue;
    const target = path.join(destination, entry);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, {
      recursive: true,
      force: true,
      errorOnExist: false,
      preserveTimestamps: true
    });
  }
}

function assertReplaceable(directory, markerName, force) {
  if (fs.existsSync(directory) && !managedInstall(directory, markerName) && !force) {
    throw new Error(`Refusing to replace unmanaged directory: ${directory}. Re-run with --force to replace it.`);
  }
}

export function installGlobalSkill({
  rootDir = packageRoot,
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = resolveGlobalRuntimeDir(),
  agentsDir = resolveGlobalAgentsDir(),
  mcpConfigPath = resolveGlobalMcpConfig(),
  force = false,
  installedAt = new Date().toISOString()
} = {}) {
  const sourceDir = path.join(rootDir, 'skills', 'excalidraw-skill');
  const sourceMissing = missingBundleFiles(sourceDir);
  if (sourceMissing.length > 0) {
    throw new Error(`Skill bundle is incomplete: ${sourceMissing.join(', ')}`);
  }
  const runtimeSourceMissing = missingRuntimeFiles(rootDir);
  if (runtimeSourceMissing.length > 0) {
    throw new Error(`Runtime bundle is incomplete: ${runtimeSourceMissing.join(', ')}`);
  }

  const sourceResolved = path.resolve(sourceDir);
  const targetResolved = path.resolve(targetDir);
  const runtimeResolved = path.resolve(runtimeDir);
  if (sourceResolved === targetResolved) {
    throw new Error('Global skill target must be different from the package source directory.');
  }
  if (targetResolved === runtimeResolved) {
    throw new Error('Global skill and runtime targets must be different directories.');
  }

  assertReplaceable(targetResolved, INSTALL_MARKER, force);
  assertReplaceable(runtimeResolved, RUNTIME_MARKER, force);

  const suffix = `${process.pid}-${Date.now()}`;
  const skillParent = path.dirname(targetResolved);
  const runtimeParent = path.dirname(runtimeResolved);
  const temporarySkill = path.join(skillParent, `.excalidraw-skill.tmp-${suffix}`);
  const temporaryRuntime = path.join(runtimeParent, `.excalidraw-runtime.tmp-${suffix}`);
  const backupSkill = path.join(skillParent, `.excalidraw-skill.backup-${suffix}`);
  const backupRuntime = path.join(runtimeParent, `.excalidraw-runtime.backup-${suffix}`);
  fs.mkdirSync(skillParent, { recursive: true });
  fs.mkdirSync(runtimeParent, { recursive: true });
  for (const item of [temporarySkill, temporaryRuntime, backupSkill, backupRuntime]) removeIfExists(item);

  fs.cpSync(sourceResolved, temporarySkill, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: true
  });
  copyRuntime(rootDir, temporaryRuntime);

  const resolvedAgentsDir = path.resolve(agentsDir);
  const resolvedMcpConfigPath = path.resolve(mcpConfigPath);
  fs.mkdirSync(resolvedAgentsDir, { recursive: true });
  for (const file of AGENT_FILES) {
    fs.copyFileSync(path.join(rootDir, '.github', 'agents', file), path.join(resolvedAgentsDir, file));
  }
  writeJson(path.join(resolvedAgentsDir, AGENTS_MARKER), {
    managedBy: 'excalidraw-skill',
    files: AGENT_FILES
  });

  const version = packageVersion(rootDir);
  const runtimeEntry = path.join(runtimeResolved, 'bin', 'excalidraw-skill.mjs');
  writeJson(path.join(temporarySkill, INSTALL_MARKER), {
    managedBy: 'excalidraw-skill',
    version,
    installedAt,
    runtimeDir: runtimeResolved,
    runtimeEntry
  });
  writeJson(path.join(temporaryRuntime, RUNTIME_MARKER), {
    managedBy: 'excalidraw-skill',
    version,
    installedAt,
    skillDir: targetResolved
  });

  let mcpConfig = {};
  if (fs.existsSync(resolvedMcpConfigPath)) mcpConfig = readJson(resolvedMcpConfigPath);
  if (!mcpConfig || typeof mcpConfig !== 'object' || Array.isArray(mcpConfig)) {
    throw new Error(`MCP config must contain a JSON object: ${resolvedMcpConfigPath}`);
  }
  const serverKey = mcpConfig.mcpServers ? 'mcpServers' : mcpConfig.servers ? 'servers' : 'mcpServers';
  const servers = mcpConfig[serverKey] && typeof mcpConfig[serverKey] === 'object' && !Array.isArray(mcpConfig[serverKey])
    ? { ...mcpConfig[serverKey] }
    : {};
  servers[MANAGED_MCP_SERVER] = {
    type: 'stdio',
    command: process.execPath,
    args: [path.join(runtimeResolved, 'mcp', 'server.mjs')],
    cwd: '${workspaceFolder}'
  };
  writeJson(resolvedMcpConfigPath, { ...mcpConfig, [serverKey]: servers });

  const replacedSkill = fs.existsSync(targetResolved);
  const replacedRuntime = fs.existsSync(runtimeResolved);
  try {
    if (replacedSkill) fs.renameSync(targetResolved, backupSkill);
    if (replacedRuntime) fs.renameSync(runtimeResolved, backupRuntime);
    fs.renameSync(temporaryRuntime, runtimeResolved);
    fs.renameSync(temporarySkill, targetResolved);
    removeIfExists(backupSkill);
    removeIfExists(backupRuntime);
  } catch (error) {
    removeIfExists(targetResolved);
    removeIfExists(runtimeResolved);
    if (fs.existsSync(backupSkill)) fs.renameSync(backupSkill, targetResolved);
    if (fs.existsSync(backupRuntime)) fs.renameSync(backupRuntime, runtimeResolved);
    throw error;
  } finally {
    for (const item of [temporarySkill, temporaryRuntime, backupSkill, backupRuntime]) removeIfExists(item);
  }

  return {
    ok: true,
    installed: true,
    replaced: replacedSkill || replacedRuntime,
    replacedSkill,
    replacedRuntime,
    targetDir: targetResolved,
    runtimeDir: runtimeResolved,
    runtimeEntry,
    agentsDir: resolvedAgentsDir,
    mcpConfigPath: resolvedMcpConfigPath,
    version
  };
}

export function doctorGlobalSkill({
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = null,
  agentsDir = null,
  mcpConfigPath = null,
  checkCli = true,
  env = process.env,
  platform = process.platform
} = {}) {
  const targetResolved = path.resolve(targetDir);
  const marker = readMarker(targetResolved, INSTALL_MARKER);
  const runtimeResolved = path.resolve(runtimeDir ?? marker?.runtimeDir ?? resolveGlobalRuntimeDir({ env }));
  const runtimeEntry = marker?.runtimeEntry ?? path.join(runtimeResolved, 'bin', 'excalidraw-skill.mjs');
  const agentsResolved = path.resolve(agentsDir ?? resolveGlobalAgentsDir({ env }));
  const mcpConfigResolved = path.resolve(mcpConfigPath ?? resolveGlobalMcpConfig({ env }));
  const missing = fs.existsSync(targetResolved) ? missingBundleFiles(targetResolved) : [...REQUIRED_FILES];
  const runtimeMissing = fs.existsSync(runtimeResolved) ? missingRuntimeFiles(runtimeResolved) : [...REQUIRED_RUNTIME_FILES];
  const managed = marker?.managedBy === 'excalidraw-skill';
  const runtimeManaged = managedInstall(runtimeResolved, RUNTIME_MARKER);
  const cliPath = checkCli ? findExecutableOnPath('excalidraw-skill', { env, platform }) : null;
  const skillOk = fs.existsSync(targetResolved) && managed && missing.length === 0;
  const runtimeOk = fs.existsSync(runtimeResolved)
    && runtimeManaged
    && runtimeMissing.length === 0
    && fs.existsSync(runtimeEntry);
  const missingAgents = fs.existsSync(agentsResolved)
    ? AGENT_FILES.filter((file) => !fs.existsSync(path.join(agentsResolved, file)))
    : [...AGENT_FILES];
  let mcpConfig = null;
  try { mcpConfig = readJson(mcpConfigResolved); } catch { /* absent or invalid */ }
  const mcpEntry = mcpConfig?.mcpServers?.[MANAGED_MCP_SERVER] ?? mcpConfig?.servers?.[MANAGED_MCP_SERVER];
  const mcpOk = Boolean(
    mcpEntry
    && mcpEntry.command === process.execPath
    && Array.isArray(mcpEntry.args)
    && mcpEntry.args.length === 1
    && path.resolve(mcpEntry.args[0]) === path.resolve(path.join(runtimeResolved, 'mcp', 'server.mjs'))
    && fs.existsSync(mcpEntry.args[0])
  );
  const agentsOk = missingAgents.length === 0;
  const cliOk = !checkCli || Boolean(cliPath);
  return {
    ok: skillOk && runtimeOk && agentsOk && mcpOk,
    skillOk,
    runtimeOk,
    agentsOk,
    mcpOk,
    cliOk,
    cliPath,
    targetDir: targetResolved,
    runtimeDir: runtimeResolved,
    runtimeEntry,
    managed,
    runtimeManaged,
    version: marker?.version ?? null,
    missing,
    runtimeMissing,
    missingAgents,
    mcpConfigPath: mcpConfigResolved,
    warning: checkCli && !cliPath
      ? 'Optional PATH command is not installed. The skill can still use runtimeEntry directly. Avoid sudo; use a Node version manager or a user-owned npm prefix if you want the convenience command.'
      : null
  };
}

export function uninstallGlobalSkill({
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = null,
  agentsDir = null,
  mcpConfigPath = null,
  force = false
} = {}) {
  const targetResolved = path.resolve(targetDir);
  const marker = readMarker(targetResolved, INSTALL_MARKER);
  const runtimeResolved = path.resolve(runtimeDir ?? marker?.runtimeDir ?? resolveGlobalRuntimeDir());
  const agentsResolved = path.resolve(agentsDir ?? resolveGlobalAgentsDir());
  const mcpConfigResolved = path.resolve(mcpConfigPath ?? resolveGlobalMcpConfig());

  if (fs.existsSync(targetResolved) && !managedInstall(targetResolved, INSTALL_MARKER) && !force) {
    throw new Error(`Refusing to remove unmanaged directory: ${targetResolved}. Re-run with --force to remove it.`);
  }
  if (fs.existsSync(runtimeResolved) && !managedInstall(runtimeResolved, RUNTIME_MARKER) && !force) {
    throw new Error(`Refusing to remove unmanaged directory: ${runtimeResolved}. Re-run with --force to remove it.`);
  }

  const removedSkill = fs.existsSync(targetResolved);
  const removedRuntime = fs.existsSync(runtimeResolved);
  removeIfExists(targetResolved);
  removeIfExists(runtimeResolved);
  const agentMarker = readMarker(agentsResolved, AGENTS_MARKER);
  if (agentMarker?.managedBy === 'excalidraw-skill') {
    for (const file of agentMarker.files ?? []) removeIfExists(path.join(agentsResolved, file));
    removeIfExists(path.join(agentsResolved, AGENTS_MARKER));
  }
  if (fs.existsSync(mcpConfigResolved)) {
    const config = readJson(mcpConfigResolved);
    const serverKey = config?.mcpServers?.[MANAGED_MCP_SERVER]?.command === process.execPath
      ? 'mcpServers'
      : config?.servers?.[MANAGED_MCP_SERVER]?.command === process.execPath ? 'servers' : null;
    if (serverKey) {
      const servers = { ...config[serverKey] };
      delete servers[MANAGED_MCP_SERVER];
      writeJson(mcpConfigResolved, { ...config, [serverKey]: servers });
    }
  }
  return {
    ok: true,
    removed: removedSkill || removedRuntime,
    removedSkill,
    removedRuntime,
    targetDir: targetResolved,
    runtimeDir: runtimeResolved,
    agentsDir: agentsResolved,
    mcpConfigPath: mcpConfigResolved
  };
}
