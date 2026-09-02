import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(moduleDir, '..');
export const INSTALL_MARKER = '.excalidraw-skill-install.json';
export const RUNTIME_MARKER = '.excalidraw-skill-runtime.json';

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
  'node_modules/@resvg',
  'package.json'
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
  if (sourceResolved === targetResolved || path.resolve(rootDir) === runtimeResolved) {
    throw new Error('Install destination must differ from source directories.');
  }

  assertReplaceable(targetResolved, INSTALL_MARKER, force);
  assertReplaceable(runtimeResolved, RUNTIME_MARKER, force);

  const suffix = `${process.pid}-${Date.now()}`;
  const skillStage = `${targetResolved}.stage-${suffix}`;
  const runtimeStage = `${runtimeResolved}.stage-${suffix}`;
  const skillBackup = `${targetResolved}.backup-${suffix}`;
  const runtimeBackup = `${runtimeResolved}.backup-${suffix}`;
  const version = packageVersion(rootDir);

  try {
    removeIfExists(skillStage);
    removeIfExists(runtimeStage);
    fs.mkdirSync(path.dirname(skillStage), { recursive: true });
    fs.mkdirSync(path.dirname(runtimeStage), { recursive: true });
    fs.cpSync(sourceDir, skillStage, { recursive: true, force: true });
    copyRuntime(rootDir, runtimeStage);

    const runtimeEntry = path.join(runtimeResolved, 'bin', 'excalidraw-skill.mjs');
    writeJson(path.join(skillStage, INSTALL_MARKER), {
      managedBy: 'excalidraw-skill',
      version,
      installedAt,
      source: sourceResolved,
      runtimeDir: runtimeResolved,
      runtimeEntry
    });
    writeJson(path.join(runtimeStage, RUNTIME_MARKER), {
      managedBy: 'excalidraw-skill',
      version,
      installedAt,
      source: path.resolve(rootDir),
      skillDir: targetResolved,
      runtimeEntry
    });

    const skillStageMissing = missingBundleFiles(skillStage);
    const runtimeStageMissing = missingRuntimeFiles(runtimeStage);
    if (skillStageMissing.length > 0 || runtimeStageMissing.length > 0) {
      throw new Error(`Staged install is incomplete: ${[...skillStageMissing, ...runtimeStageMissing].join(', ')}`);
    }

    if (fs.existsSync(targetResolved)) fs.renameSync(targetResolved, skillBackup);
    if (fs.existsSync(runtimeResolved)) fs.renameSync(runtimeResolved, runtimeBackup);
    fs.renameSync(skillStage, targetResolved);
    fs.renameSync(runtimeStage, runtimeResolved);
    removeIfExists(skillBackup);
    removeIfExists(runtimeBackup);

    return {
      ok: true,
      targetDir: targetResolved,
      runtimeDir: runtimeResolved,
      runtimeEntry,
      version
    };
  } catch (error) {
    removeIfExists(skillStage);
    removeIfExists(runtimeStage);
    if (!fs.existsSync(targetResolved) && fs.existsSync(skillBackup)) fs.renameSync(skillBackup, targetResolved);
    if (!fs.existsSync(runtimeResolved) && fs.existsSync(runtimeBackup)) fs.renameSync(runtimeBackup, runtimeResolved);
    removeIfExists(skillBackup);
    removeIfExists(runtimeBackup);
    throw error;
  }
}

export function doctorGlobalSkill({
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = resolveGlobalRuntimeDir(),
  env = process.env
} = {}) {
  const marker = readMarker(targetDir, INSTALL_MARKER);
  const runtimeMarker = readMarker(runtimeDir, RUNTIME_MARKER);
  const skillMissing = missingBundleFiles(targetDir);
  const runtimeMissing = missingRuntimeFiles(runtimeDir);
  const skillOk = marker?.managedBy === 'excalidraw-skill' && skillMissing.length === 0;
  const runtimeOk = runtimeMarker?.managedBy === 'excalidraw-skill'
    && runtimeMissing.length === 0
    && runtimeMarker.runtimeEntry === path.join(path.resolve(runtimeDir), 'bin', 'excalidraw-skill.mjs');
  const cliPath = findExecutableOnPath('excalidraw-skill', { env });

  return {
    ok: skillOk && runtimeOk,
    skillOk,
    runtimeOk,
    cliOk: Boolean(cliPath),
    targetDir: path.resolve(targetDir),
    runtimeDir: path.resolve(runtimeDir),
    runtimeEntry: runtimeMarker?.runtimeEntry ?? marker?.runtimeEntry ?? null,
    cliPath,
    skillMissing,
    runtimeMissing,
    marker,
    runtimeMarker
  };
}

export function uninstallGlobalSkill({
  targetDir = resolveGlobalSkillDir(),
  runtimeDir = resolveGlobalRuntimeDir(),
  force = false
} = {}) {
  const removed = [];
  for (const [directory, markerName] of [[targetDir, INSTALL_MARKER], [runtimeDir, RUNTIME_MARKER]]) {
    if (!fs.existsSync(directory)) continue;
    if (!managedInstall(directory, markerName) && !force) {
      throw new Error(`Refusing to remove unmanaged directory: ${directory}. Re-run with --force to remove it.`);
    }
    fs.rmSync(directory, { recursive: true, force: true });
    removed.push(path.resolve(directory));
  }
  return { ok: true, removed };
}
