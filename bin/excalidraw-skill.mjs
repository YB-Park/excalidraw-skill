#!/usr/bin/env node

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [command = 'help', ...args] = process.argv.slice(2);

const runners = {
  render: 'src/render.mjs',
  inspect: 'src/inspect-scene.mjs',
  validate: 'src/validate.mjs',
  patch: 'src/patch.mjs'
};

function run(file) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
}

if (command === 'doctor') {
  console.log('excalidraw-skill doctor: ok');
  console.log(`node: ${process.version}`);
} else if (command === 'init') {
  console.log('excalidraw-skill init: scaffold');
} else if (command === 'list-shapes') {
  console.log(fs.readFileSync('skills/excalidraw-skill/catalog/shapes.index.json', 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  console.log('Usage: excalidraw-skill <doctor|init|list-shapes|render|inspect|patch|validate>');
}
