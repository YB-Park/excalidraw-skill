#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const [specPath] = process.argv.slice(2);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runStep(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if ((result.status ?? 0) !== 0) process.exit(result.status ?? 1);
}

function main() {
  if (!specPath) {
    console.error('Usage: node src/build.mjs <spec.json>');
    process.exit(1);
  }

  const spec = readJson(specPath);
  const outputPath = spec.outputPath ?? 'diagram.excalidraw';

  runStep(['src/render.mjs', specPath]);
  runStep(['src/style-by-kind.mjs', outputPath]);
  runStep(['src/style-edges.mjs', outputPath]);
  runStep(['src/frame-groups.mjs', outputPath, specPath]);
  runStep(['src/label-edges.mjs', outputPath]);
  runStep(['src/validate.mjs', outputPath]);

  console.log(outputPath);
}

main();
