#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  doctorGlobalSkill,
  installGlobalSkill,
  uninstallGlobalSkill
} from '../src/global-skill.mjs';

const [command = 'help', ...args] = process.argv.slice(2);
const binDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(binDir, '..');
const invocationCwd = process.cwd();

const runners = {
  render: 'src/render.mjs',
  inspect: 'src/inspect-scene.mjs',
  validate: 'src/validate.mjs',
  patch: 'src/patch.mjs',
  build: 'src/build.mjs',
  init: 'src/init.mjs',
  evaluate: 'src/evaluate-suite.mjs',
  'check-refs': 'src/check-refs.mjs',
  'label-edges': 'src/label-edges.mjs',
  'layout-service-flow': 'src/layout-service-flow.mjs',
  'layout-system-architecture': 'src/layout-system-architecture.mjs',
  'layout-module-architecture': 'src/layout-module-architecture.mjs',
  'quality-report': 'src/quality-report.mjs'
};

function fromRoot(relativePath) {
  return path.join(rootDir, relativePath);
}

function run(file) {
  const result = spawnSync(process.execPath, [fromRoot(file), ...args], {
    stdio: 'inherit',
    cwd: invocationCwd
  });
  process.exit(result.status ?? 1);
}

function hasFlag(flag) {
  return args.includes(flag);
}

function requireGlobal() {
  if (!hasFlag('--global')) {
    console.error('This command requires --global. Use `excalidraw-skill init` for project-local setup.');
    process.exit(1);
  }
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

if (command === 'doctor') {
  if (hasFlag('--global')) {
    const report = doctorGlobalSkill();
    printResult(report);
    process.exit(report.ok ? 0 : 1);
  }
  console.log('excalidraw-skill doctor: ok');
  console.log(`node: ${process.version}`);
  console.log(`workspace: ${invocationCwd}`);
} else if (command === 'install') {
  requireGlobal();
  printResult(installGlobalSkill({ rootDir, force: hasFlag('--force') }));
} else if (command === 'uninstall') {
  requireGlobal();
  printResult(uninstallGlobalSkill({ force: hasFlag('--force') }));
} else if (command === 'list-shapes') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/catalog/shapes.index.json'), 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  console.log('Usage: excalidraw-skill <doctor|install --global|uninstall --global|init|list-shapes|render|inspect|check-refs|patch|build|evaluate|layout-service-flow|layout-system-architecture|layout-module-architecture|quality-report|label-edges|validate>');
}
