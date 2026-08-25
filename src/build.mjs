#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [specPath] = process.argv.slice(2);
const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const invocationCwd = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(invocationCwd, filePath), 'utf8'));
}

function runStep(relativeFile, args) {
  const file = path.join(rootDir, relativeFile);
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: 'inherit',
    cwd: invocationCwd
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

function main() {
  if (!specPath) {
    console.error('Usage: node src/build.mjs <spec.json>');
    process.exit(1);
  }

  const spec = readJson(specPath);
  const outputPath = spec.outputPath ?? 'diagram.excalidraw';

  runStep('src/render.mjs', [specPath]);
  runStep('src/style-by-kind.mjs', [outputPath]);
  runStep('src/layout-service-flow.mjs', [outputPath, specPath]);
  runStep('src/layout-system-architecture.mjs', [outputPath, specPath]);
  runStep('src/layout-module-architecture.mjs', [outputPath, specPath]);
  runStep('src/apply-components.mjs', [outputPath]);
  runStep('src/group-component-details.mjs', [outputPath]);
  runStep('src/route-edges.mjs', [outputPath, specPath]);
  runStep('src/repair-routes.mjs', [outputPath]);
  runStep('src/style-edges.mjs', [outputPath]);
  runStep('src/frame-groups.mjs', [outputPath, specPath]);
  runStep('src/assign-frame-membership.mjs', [outputPath]);
  runStep('src/label-edges.mjs', [outputPath]);
  runStep('src/place-edge-labels.mjs', [outputPath, specPath]);
  runStep('src/apply-fonts.mjs', [outputPath]);
  runStep('src/editability-report.mjs', [outputPath]);
  runStep('src/validate.mjs', [outputPath]);
  runStep('src/quality-report.mjs', [outputPath, specPath]);

  console.log(outputPath);
}

main();
