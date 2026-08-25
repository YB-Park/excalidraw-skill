#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createPerceptualQuality } from './perceptual-quality.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/perceptual-quality-report.mjs <scene.excalidraw> [spec.json] [-o report.json]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = specPathArg && specPathArg !== '-o'
    ? path.resolve(process.cwd(), specPathArg)
    : null;
  const actualFlag = specPath ? flag : specPathArg;
  const actualOutput = specPath ? outputPathArg : flag;
  const outputPath = actualFlag === '-o' && actualOutput
    ? path.resolve(process.cwd(), actualOutput)
    : `${scenePath}.perceptual.json`;
  const report = createPerceptualQuality(
    readJson(scenePath),
    specPath ? readJson(specPath) : null
  );
  writeJson(outputPath, report);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    mode: report.mode,
    metrics: report.metrics,
    warnings: report.details.warnings
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`perceptual-quality-report failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
