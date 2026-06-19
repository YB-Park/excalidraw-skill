import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(moduleDir, '..');
export const INSTALL_MARKER = '.excalidraw-skill-install.json';

const REQUIRED_FILES = Object.freeze([
  'SKILL.md',
  'guides/create.md',
  'guides/edit.md',
  'guides/style.md',
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packageVersion(rootDir) {
  try {
    return readJson(path.join(rootDir, 'package.json')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function missingBundleFiles(dir) {
  return REQUIRED_FILES.filter((relative) => !fs.existsSync(path.join(dir, relative)));
}

function readMarker(targetDir) {
  const markerPath = path.join(targetDir, INSTALL_MARKER);
  if (!fs.existsSync(markerPath)) return null;
  try {
    return readJson(markerPath);
  } catch {
    return null;
  }
}

function managedInstall(targetDir) {
  return readMarker(targetDir)?.managedBy === 'excalidraw-skill';
}

function removeIfExists(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

export function resolveGlobalSkillDir({ env = process.env, homeDir = os.homedir() } = {}) {
  const override = env.EXCALIDRAW_SKILL_GLOBAL_DIR?.trim();
  if (override) return path.resolve(override);
  const copilotHome = env.COPILOT_HOME?.trim()
    ? path.resolve(env.COPILOT_HOME)
    : path.join(homeDir, '.copilot');
  return path.join(copilotHome, 'skills', 'excalidraw-skill');
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

export function installGlobalSkill({
  rootDir = packageRoot,
  targetDir = resolveGlobalSkillDir(),
  force = false,
  installedAt = new Date().toISOString()
} = {}) {
  const sourceDir = path.join(rootDir, 'skills', 'excalidraw-skill');
  const sourceMissing = missingBundleFiles(sourceDir);
  if (sourceMissing.length > 0) {
    throw new Error(`Skill bundle is incomplete: ${sourceMissing.join(', ')}`);
  }

  const sourceResolved = path.resolve(sourceDir);
  const targetResolved = path.resolve(targetDir);
  if (sourceResolved === targetResolved) {
    throw new Error('Global skill target must be different from the package source directory.');
  }

  if (fs.existsSync(targetResolved) && !managedInstall(targetResolved) && !force) {
    throw new Error(`Refusing to replace unmanaged directory: ${targetResolved}. Re-run with --force to replace it.`);
  }

  const parent = path.dirname(targetResolved);
  const suffix = `${process.pid}-${Date.now()}`;
  const temporary = path.join(parent, `.excalidraw-skill.tmp-${suffix}`);
  const backup = path.join(parent, `.excalidraw-skill.backup-${suffix}`);
  fs.mkdirSync(parent, { recursive: true });
  removeIfExists(temporary);
  removeIfExists(backup);

  fs.cpSync(sourceResolved, temporary, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: true
  });
  fs.writeFileSync(path.join(temporary, INSTALL_MARKER), `${JSON.stringify({
    managedBy: 'excalidraw-skill',
    version: packageVersion(rootDir),
    installedAt
  }, null, 2)}\n`);

  const replaced = fs.existsSync(targetResolved);
  try {
    if (replaced) fs.renameSync(targetResolved, backup);
    fs.renameSync(temporary, targetResolved);
    removeIfExists(backup);
  } catch (error) {
    removeIfExists(targetResolved);
    if (fs.existsSync(backup)) fs.renameSync(backup, targetResolved);
    throw error;
  } finally {
    removeIfExists(temporary);
    removeIfExists(backup);
  }

  return {
    ok: true,
    installed: true,
    replaced,
    targetDir: targetResolved,
    version: packageVersion(rootDir)
  };
}

export function doctorGlobalSkill({
  targetDir = resolveGlobalSkillDir(),
  checkCli = true,
  env = process.env,
  platform = process.platform
} = {}) {
  const targetResolved = path.resolve(targetDir);
  const missing = fs.existsSync(targetResolved) ? missingBundleFiles(targetResolved) : [...REQUIRED_FILES];
  const marker = readMarker(targetResolved);
  const managed = marker?.managedBy === 'excalidraw-skill';
  const cliPath = checkCli ? findExecutableOnPath('excalidraw-skill', { env, platform }) : null;
  const skillOk = fs.existsSync(targetResolved) && managed && missing.length === 0;
  const cliOk = !checkCli || Boolean(cliPath);
  return {
    ok: skillOk && cliOk,
    skillOk,
    cliOk,
    cliPath,
    targetDir: targetResolved,
    managed,
    version: marker?.version ?? null,
    missing,
    warning: checkCli && !cliPath
      ? 'The skill bundle is installed, but excalidraw-skill is not available on PATH. Run npm install -g . from the package checkout.'
      : null
  };
}

export function uninstallGlobalSkill({ targetDir = resolveGlobalSkillDir(), force = false } = {}) {
  const targetResolved = path.resolve(targetDir);
  if (!fs.existsSync(targetResolved)) {
    return { ok: true, removed: false, targetDir: targetResolved };
  }
  if (!managedInstall(targetResolved) && !force) {
    throw new Error(`Refusing to remove unmanaged directory: ${targetResolved}. Re-run with --force to remove it.`);
  }
  fs.rmSync(targetResolved, { recursive: true, force: true });
  return { ok: true, removed: true, targetDir: targetResolved };
}
