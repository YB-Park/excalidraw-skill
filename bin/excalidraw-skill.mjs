#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const [command = 'help', ...args] = process.argv.slice(2);
const binDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(binDir, '..');

const runners = {
  render: 'src/render.mjs',
  inspect: 'src/inspect-scene.mjs',
  validate: 'src/validate.mjs',
  patch: 'src/patch.mjs',
  build: 'src/build.mjs',
  init: 'src/init.mjs',
  'check-refs': 'src/check-refs.mjs',
  'label-edges': 'src/label-edges.mjs',
  'layout-service-flow': 'src/layout-service-flow.mjs',
  'quality-report': 'src/quality-report.mjs'
};

function fromRoot(relativePath) {
  return path.join(rootDir, relativePath);
}

function run(file) {
  const result = spawnSync(process.execPath, [fromRoot(file), ...args], { stdio: 'inherit', cwd: rootDir });
  process.exit(result.status ?? 0);
}

if (command === 'doctor') {
  console.log('excalidraw-skill doctor: ok');
  console.log(`node: ${process.version}`);
} else if (command === 'list-shapes') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/catalog/shapes.index.json'), 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  console.log('Usage: excalidraw-skill <doctor|init|list-shapes|render|inspect|check-refs|patch|build|layout-service-flow|quality-report|label-edges|validate>');
}
