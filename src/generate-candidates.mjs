#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LAYOUT_STRATEGIES, applyLayoutStrategy } from './layout-strategies.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`);
}

function runNode(relativeFile, args, cwd) {
  const result = spawnSync(process.execPath, [path.join(rootDir, relativeFile), ...args], {
    cwd,
    encoding: 'utf8'
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${relativeFile} failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result;
}

function candidateOutputPath(workspaceCwd, originalOutputPath, strategyId) {
  const absoluteOriginal = path.resolve(workspaceCwd, originalOutputPath);
  const ext = path.extname(absoluteOriginal) || '.excalidraw';
  const base = absoluteOriginal.slice(0, -ext.length);
  return `${base}.candidate-${strategyId}${ext}`;
}

export function candidateSpecs(spec) {
  return LAYOUT_STRATEGIES.map((strategy) => ({
    strategy,
    spec: applyLayoutStrategy(spec, strategy.id)
  }));
}

export function generateCandidates(specPath, { cwd = process.cwd() } = {}) {
  const workspaceCwd = path.resolve(cwd);
  const absoluteSpecPath = path.resolve(workspaceCwd, specPath);
  const original = readJson(absoluteSpecPath);
  if (!original.outputPath) throw new Error('DiagramSpec outputPath is required for candidate generation');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-candidates-'));
  const candidates = [];

  try {
    for (const { strategy, spec } of candidateSpecs(original)) {
      const outputPath = candidateOutputPath(workspaceCwd, original.outputPath, strategy.id);
      const candidateSpec = { ...spec, outputPath };
      const candidateSpecPath = path.join(tempDir, `${strategy.id}.diagram.json`);
      writeJson(candidateSpecPath, candidateSpec);

      runNode('src/build.mjs', [candidateSpecPath], workspaceCwd);
      runNode('src/review.mjs', [outputPath, candidateSpecPath], workspaceCwd);

      candidates.push({
        strategy: strategy.id,
        intent: strategy.intent,
        scenePath: outputPath,
        previewPath: `${outputPath.replace(/\.excalidraw$/i, '')}.preview.png`,
        reviewPath: `${outputPath.replace(/\.excalidraw$/i, '')}.review.json`
      });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const manifestPath = `${absoluteSpecPath.replace(/\.diagram\.json$/i, '')}.candidates.json`;
  const manifest = {
    version: '1.0',
    mode: 'cognitive-candidate-portfolio',
    sourceSpec: absoluteSpecPath,
    requiresPerceptualRanking: true,
    candidates
  };
  writeJson(manifestPath, manifest);
  return { manifestPath, manifest };
}

function main() {
  const [specPath] = process.argv.slice(2);
  if (!specPath) {
    console.error('Usage: generate-candidates <spec.diagram.json>');
    process.exit(1);
  }
  console.log(JSON.stringify(generateCandidates(specPath), null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`generate-candidates failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
