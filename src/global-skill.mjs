import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(moduleDir, '..');
export const INSTALL_MARKER = '.excalidraw-skill-install.json';
export const RUNTIME_MARKER = '.excalidraw-skill-runtime.json';
export const MANAGED_AGENT_FILES = Object.freeze([
  'excalidraw-designer.agent.md',
  'excalidraw-planner.agent.md',
  'excalidraw-critic.agent.md'
]);

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
  'mcp',
  'assets',
  'skills',
  '.opencode',
  '.github/prompts',
  'package.json'
]);

const REQUIRED_RUNTIME_FILES = Object.freeze([
  'bin/excalidraw-skill.mjs',
  'src/build.mjs',
  'src/review.mjs',
  'src/export-preview-png.mjs',
  'src/global-skill.mjs',
  'src/init.mjs',
  'mcp/server.mjs',
  'node_modules/@resvg/resvg-js/index.js',
  'node_modules/@modelcontextprotocol/server/package.json',
  'node_modules/zod/package.json',
  'skills/excalidraw-skill/SKILL.md',
  'package.json'
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
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

function sameFile(left, right) {
  return fs.existsSync(left)
    && fs.existsSync(right)
    && fs.readFileSync(left, 'utf8') === fs.readFileSync(right, 'utf8');
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

export function resolveGlobalMcpConfigPath(options = {}) {
  return path.join(copilotHome(options), 'mcp-config.json');
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

function dependencyPath(rootDir, name) {
  return path.join(rootDir, 'node_modules', ...name.split('/'));
}

function copyProductionDependencies(rootDir, destination) {
  const rootPackage = readJson(path.join(rootDir, 'package.json'));
  const queue = Object.keys(rootPackage.dependencies ?? {});
  const copied = new Set();
  while (queue.length > 0) {
    const name = queue.shift();
    if (!name || copied.has(name)) continue;
    const source = dependencyPath(rootDir, name);
    const packageFile = path.join(source, 'package.json');
    if (!fs.existsSync(packageFile)) {
      throw new Error(`Runtime dependency is not installed: ${name}`);
    }
    const target = dependencyPath(destination, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, {
      recursive: true,
      force: true,
      errorOnExist: false,
      preserveTimestamps: true
    });
    copied.add(name);
    const manifest = readJson(packageFile);
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!copied.has(dependency)) queue.push(dependency);
    }
  }
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
  copyProductionDependencies(rootDir, destination);
}

function assertReplaceable(directory, markerName, force) {
  if (fs.existsSync(directory) && !managedInstall(directory, markerName) && !force) {
    throw new Error(`Refusing to replace unmanaged directory: ${directory}. Re-run with --force to replace it.`);
  }
}

function managedMcpServer(runtimeDir, nodeExecutable = process.execPath) {
  return {
    type: 'stdio',
    command: nodeExecutable,
    args: [path.join(runtimeDir, 'mcp', 'server.mjs')]
  };
}

function readMcpConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};
  const config = readJson(configPath);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`MCP configuration must be a JSON object: ${configPath}`);
  }
  return config;
}

function writeManagedAgents(rootDir, agentsDir, force) {
  const sourceDir = path.join(rootDir, '.github', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const name of MANAGED_AGENT_FILES) {
    const source = path.join(sourceDir, name);
    const target = path.join(agentsDir, name);
    if (!fs.existsSync(source)) throw new Error(`Missing agent source: ${source}`);
    if (fs.existsSync(target) && !sameFile(source, target) && !force) {
      throw new Error(`Refusing to replace unmanaged agent file: ${target}. Re-run with --force to replace it.`);
    }
    fs.copyFileSync(source, target);
  }
}

function removeManagedAgents(rootDir, agentsDir, force) {
  const sourceDir = path.join(rootDir, '.github', 'agents');
  let removed = false;
  for (const name of MANAGED_AGENT_FILES) {
    const source = path.join(sourceDir, name);
    const target = path.join(agentsDir, name);
    if (!fs.existsSync(target)) continue;
    if (!force && fs.existsSync(source) && !sameFile(source, target)) continue;
    fs.rmSync(target, { force: true });
    removed = true;
  }
  return removed;
}

function writeManagedMcpConfig(configPath, runtimeDir, nodeExecutable, force) {
  const config = readMcpConfig(configPath);
  const servers = config.servers && typeof config.servers === 'object' && !Array.isArray(config.servers)
    ? { ...config.servers }
    : {};
  const expected = managedMcpServer(runtimeDir, nodeExecutable);
  if (servers.excalidraw && JSON.stringify(servers.excalidraw) !== JSON.stringify(expected) && !force) {
    throw new Error(`Refusing to replace unmanaged MCP server entry: ${configPath}#servers.excalidraw. Re-run with --force to replace it.`);
  }
  servers.excalidraw = expected;
  writeJson(configPath, { ...config, servers });
  return expected;
}

function removeManagedMcpConfig(configPath, runtimeDir, nodeExecutable, force) {
  if (!fs.existsSync(configPath)) return false;
  const config = readMcpConfig(configPath);
  if (!config.servers || typeof config.servers !== 'object' || Array.isArray(config.servers)) return false;
  const current = config.servers.excalidraw;
  if (!current) return false;
  const expected = managedMcpServer(runtimeDir, nodeExecutable);
  if (!force && JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const servers = { ...config.servers };
  delete servers.excalidraw;
  const next = { ...config, servers };
  if (Object.keys(servers).length === 0 && Object.keys(config).length === 1) {
    fs.rmSync(configPath, { force: true });
  } else {
    writeJson(configPath, next);
  }
  return true;
}

export function installGlobalSkill({
  rootDir = packageRoot,
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = resolveGlobalRuntimeDir(),
  agentsDir = resolveGlobalAgentsDir(),
  mcpConfigPath = resolveGlobalMcpConfigPath(),
  nodeExecutable = process.execPath,
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
  const agentsResolved = path.resolve(agentsDir);
  const mcpConfigResolved = path.resolve(mcpConfigPath);
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

  const version = packageVersion(rootDir);
  const runtimeEntry = path.join(runtimeResolved, 'bin', 'excalidraw-skill.mjs');
  writeJson(path.join(temporarySkill, INSTALL_MARKER), {
    managedBy: 'excalidraw-skill',
    version,
    installedAt,
    runtimeDir: runtimeResolved,
    runtimeEntry,
    agentsDir: agentsResolved,
    mcpConfigPath: mcpConfigResolved,
    nodeExecutable
  });
  writeJson(path.join(temporaryRuntime, RUNTIME_MARKER), {
    managedBy: 'excalidraw-skill',
    version,
    installedAt,
    skillDir: targetResolved
  });

  const replacedSkill = fs.existsSync(targetResolved);
  const replacedRuntime = fs.existsSync(runtimeResolved);
  try {
    if (replacedSkill) fs.renameSync(targetResolved, backupSkill);
    if (replacedRuntime) fs.renameSync(runtimeResolved, backupRuntime);
    fs.renameSync(temporaryRuntime, runtimeResolved);
    fs.renameSync(temporarySkill, targetResolved);
    writeManagedAgents(rootDir, agentsResolved, force);
    const mcpServer = writeManagedMcpConfig(mcpConfigResolved, runtimeResolved, nodeExecutable, force);
    removeIfExists(backupSkill);
    removeIfExists(backupRuntime);
    return {
      ok: true,
      installed: true,
      replaced: replacedSkill || replacedRuntime,
      replacedSkill,
      replacedRuntime,
      targetDir: targetResolved,
      runtimeDir: runtimeResolved,
      runtimeEntry,
      agentsDir: agentsResolved,
      mcpConfigPath: mcpConfigResolved,
      mcpServer,
      version
    };
  } catch (error) {
    removeIfExists(targetResolved);
    removeIfExists(runtimeResolved);
    if (fs.existsSync(backupSkill)) fs.renameSync(backupSkill, targetResolved);
    if (fs.existsSync(backupRuntime)) fs.renameSync(backupRuntime, runtimeResolved);
    throw error;
  } finally {
    for (const item of [temporarySkill, temporaryRuntime, backupSkill, backupRuntime]) removeIfExists(item);
  }
}

export function doctorGlobalSkill({
  rootDir = packageRoot,
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = null,
  agentsDir = null,
  mcpConfigPath = null,
  nodeExecutable = null,
  checkCli = true,
  env = process.env,
  platform = process.platform
} = {}) {
  const targetResolved = path.resolve(targetDir);
  const marker = readMarker(targetResolved, INSTALL_MARKER);
  const runtimeResolved = path.resolve(runtimeDir ?? marker?.runtimeDir ?? resolveGlobalRuntimeDir({ env }));
  const agentsResolved = path.resolve(agentsDir ?? marker?.agentsDir ?? resolveGlobalAgentsDir({ env }));
  const mcpConfigResolved = path.resolve(mcpConfigPath ?? marker?.mcpConfigPath ?? resolveGlobalMcpConfigPath({ env }));
  const effectiveNode = nodeExecutable ?? marker?.nodeExecutable ?? process.execPath;
  const runtimeEntry = marker?.runtimeEntry ?? path.join(runtimeResolved, 'bin', 'excalidraw-skill.mjs');
  const missing = fs.existsSync(targetResolved) ? missingBundleFiles(targetResolved) : [...REQUIRED_FILES];
  const runtimeMissing = fs.existsSync(runtimeResolved) ? missingRuntimeFiles(runtimeResolved) : [...REQUIRED_RUNTIME_FILES];
  const managed = marker?.managedBy === 'excalidraw-skill';
  const runtimeManaged = managedInstall(runtimeResolved, RUNTIME_MARKER);
  const cliPath = checkCli ? findExecutableOnPath('excalidraw-skill', { env, platform }) : null;
  const skillOk = fs.existsSync(targetResolved) && managed && missing.length === 0;
  const runtimeOk = fs.existsSync(runtimeResolved)
    && runtimeManaged
    && runtimeMissing.length === 0
    && fs.existsSync(runtimeEntry)
    && fs.existsSync(path.join(runtimeResolved, 'mcp', 'server.mjs'));
  const agentMissing = MANAGED_AGENT_FILES.filter((name) => !sameFile(
    path.join(rootDir, '.github', 'agents', name),
    path.join(agentsResolved, name)
  ));
  const agentsOk = agentMissing.length === 0;
  let mcpServer = null;
  try {
    mcpServer = readMcpConfig(mcpConfigResolved).servers?.excalidraw ?? null;
  } catch {
    mcpServer = null;
  }
  const expectedMcpServer = managedMcpServer(runtimeResolved, effectiveNode);
  const mcpOk = JSON.stringify(mcpServer) === JSON.stringify(expectedMcpServer)
    && fs.existsSync(expectedMcpServer.args[0]);
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
    agentsDir: agentsResolved,
    mcpConfigPath: mcpConfigResolved,
    mcpServer,
    managed,
    runtimeManaged,
    version: marker?.version ?? null,
    missing,
    runtimeMissing,
    agentMissing,
    warning: checkCli && !cliPath
      ? 'Optional PATH command is not installed. The skill can still use runtimeEntry directly. Avoid sudo; use a Node version manager or a user-owned npm prefix if you want the convenience command.'
      : null
  };
}

export function uninstallGlobalSkill({
  rootDir = packageRoot,
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = null,
  agentsDir = null,
  mcpConfigPath = null,
  nodeExecutable = null,
  force = false
} = {}) {
  const targetResolved = path.resolve(targetDir);
  const marker = readMarker(targetResolved, INSTALL_MARKER);
  const runtimeResolved = path.resolve(runtimeDir ?? marker?.runtimeDir ?? resolveGlobalRuntimeDir());
  const agentsResolved = path.resolve(agentsDir ?? marker?.agentsDir ?? resolveGlobalAgentsDir());
  const mcpConfigResolved = path.resolve(mcpConfigPath ?? marker?.mcpConfigPath ?? resolveGlobalMcpConfigPath());
  const effectiveNode = nodeExecutable ?? marker?.nodeExecutable ?? process.execPath;

  if (fs.existsSync(targetResolved) && !managedInstall(targetResolved, INSTALL_MARKER) && !force) {
    throw new Error(`Refusing to remove unmanaged directory: ${targetResolved}. Re-run with --force to remove it.`);
  }
  if (fs.existsSync(runtimeResolved) && !managedInstall(runtimeResolved, RUNTIME_MARKER) && !force) {
    throw new Error(`Refusing to remove unmanaged directory: ${runtimeResolved}. Re-run with --force to remove it.`);
  }

  const removedAgents = removeManagedAgents(rootDir, agentsResolved, force);
  const removedMcp = removeManagedMcpConfig(mcpConfigResolved, runtimeResolved, effectiveNode, force);
  const removedSkill = fs.existsSync(targetResolved);
  const removedRuntime = fs.existsSync(runtimeResolved);
  removeIfExists(targetResolved);
  removeIfExists(runtimeResolved);
  return {
    ok: true,
    removed: removedSkill || removedRuntime || removedAgents || removedMcp,
    removedSkill,
    removedRuntime,
    removedAgents,
    removedMcp,
    targetDir: targetResolved,
    runtimeDir: runtimeResolved,
    agentsDir: agentsResolved,
    mcpConfigPath: mcpConfigResolved
  };
}
