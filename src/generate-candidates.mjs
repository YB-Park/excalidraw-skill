#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LAYOUT_STRATEGIES, applyLayoutStrategy, isFlowSpec } from './layout-strategies.mjs';

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

function opaqueCandidateId(index) {
  return `c${String(index + 1).padStart(2, '0')}`;
}

function candidateOutputPath(workspaceCwd, originalOutputPath, candidateId) {
  const absoluteOriginal = path.resolve(workspaceCwd, originalOutputPath);
  const ext = path.extname(absoluteOriginal) || '.excalidraw';
  const base = absoluteOriginal.slice(0, -ext.length);
  return `${base}.candidate-${candidateId}${ext}`;
}

function assertCandidateFamily(spec) {
  if (!isFlowSpec(spec)) {
    throw new Error(`Cognitive candidate portfolio currently supports flow families only; received ${spec?.diagramType ?? 'unknown'}. Use the deterministic build/review path for this family.`);
  }
}

export function candidateSpecs(spec) {
  assertCandidateFamily(spec);
  return LAYOUT_STRATEGIES.map((strategy, index) => ({
    candidateId: opaqueCandidateId(index),
    strategy,
    spec: applyLayoutStrategy(spec, strategy.id)
  }));
}

export function blindCandidateView(manifest) {
  return (manifest?.candidates ?? []).map(({ candidateId, scenePath, previewPath, reviewPath }) => ({
    candidateId,
    scenePath,
    previewPath,
    reviewPath
  }));
}

export function generateCandidates(specPath, { cwd = process.cwd() } = {}) {
  const workspaceCwd = path.resolve(cwd);
  const absoluteSpecPath = path.resolve(workspaceCwd, specPath);
  const original = readJson(absoluteSpecPath);
  if (!original.outputPath) throw new Error('DiagramSpec outputPath is required for candidate generation');
  assertCandidateFamily(original);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-candidates-'));
  const candidates = [];

  try {
    for (const { candidateId, strategy, spec } of candidateSpecs(original)) {
      const outputPath = candidateOutputPath(workspaceCwd, original.outputPath, candidateId);
      const candidateSpec = { ...spec, outputPath };
      const candidateSpecPath = path.join(tempDir, `${candidateId}.diagram.json`);
      writeJson(candidateSpecPath, candidateSpec);

      runNode('src/build.mjs', [candidateSpecPath], workspaceCwd);
      runNode('src/review.mjs', [outputPath, candidateSpecPath], workspaceCwd);

      candidates.push({
        candidateId,
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
    version: '1.1',
    mode: 'cognitive-candidate-portfolio',
    supportedFamily: 'flow',
    sourceSpec: absoluteSpecPath,
    requiresPerceptualRanking: true,
    candidates
  };
  writeJson(manifestPath, manifest);
  return { manifestPath, manifest, blindCandidates: blindCandidateView(manifest) };
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
