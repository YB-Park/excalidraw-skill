#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mergeEvaluationSuites } from './evaluate-suite.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const defaultSuitePath = 'examples/evaluation/suite.json';
const defaultQualityCorpusPath = 'examples/evaluation/quality-corpus.json';
const defaultManifestPath = 'examples/evaluation/actual-render-manifest.json';
const defaultRenderDir = 'artifacts/actual-render';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runnableCases(suite) {
  return (suite.cases ?? []).filter((entry) => entry.implementationStatus === 'runnable' && entry.fixture);
}

export function validateActualRenderCoverage(suite, manifest) {
  const runnable = runnableCases(suite);
  const expectedIds = runnable.map((entry) => entry.id).sort();
  const configured = manifest?.cases && typeof manifest.cases === 'object' && !Array.isArray(manifest.cases)
    ? manifest.cases
    : {};
  const configuredIds = Object.keys(configured).sort();
  const expectedSet = new Set(expectedIds);
  const configuredSet = new Set(configuredIds);
  const missing = expectedIds.filter((id) => !configuredSet.has(id));
  const unexpected = configuredIds.filter((id) => !expectedSet.has(id));
  const fileNames = configuredIds.map((id) => configured[id]);
  const invalidFileNames = configuredIds.filter((id) => typeof configured[id] !== 'string' || !/^[a-z0-9][a-z0-9-]*\.png$/u.test(configured[id]));
  const duplicates = [...new Set(fileNames.filter((name, index) => fileNames.indexOf(name) !== index))].sort();
  return {
    pass: missing.length === 0 && unexpected.length === 0 && invalidFileNames.length === 0 && duplicates.length === 0,
    runnableCount: runnable.length,
    configuredCount: configuredIds.length,
    missing,
    unexpected,
    invalidFileNames,
    duplicates
  };
}

export function resolveActualRenderCases(suite, manifest, projectRoot = rootDir) {
  const coverage = validateActualRenderCoverage(suite, manifest);
  if (!coverage.pass) {
    throw new Error(`Actual-render manifest coverage mismatch: ${JSON.stringify(coverage)}`);
  }

  return runnableCases(suite).map((entry) => {
    const fixturePath = path.resolve(projectRoot, entry.fixture);
    if (!fs.existsSync(fixturePath)) throw new Error(`Actual-render fixture not found: ${entry.fixture}`);
    const fixture = readJson(fixturePath);
    if (typeof fixture.outputPath !== 'string' || fixture.outputPath.trim() === '') {
      throw new Error(`Actual-render fixture has no outputPath: ${entry.fixture}`);
    }
    return {
      id: entry.id,
      fixture: entry.fixture,
      scenePath: path.resolve(projectRoot, fixture.outputPath),
      fileName: manifest.cases[entry.id]
    };
  });
}

export function renderActualSuite(options = {}) {
  const projectRoot = path.resolve(options.rootDir ?? rootDir);
  const suitePath = path.resolve(projectRoot, options.suitePath ?? defaultSuitePath);
  const qualityCorpusPath = path.resolve(projectRoot, options.qualityCorpusPath ?? defaultQualityCorpusPath);
  const manifestPath = path.resolve(projectRoot, options.manifestPath ?? defaultManifestPath);
  const renderDir = path.resolve(projectRoot, options.renderDir ?? defaultRenderDir);
  const qualityCorpus = fs.existsSync(qualityCorpusPath) ? readJson(qualityCorpusPath) : null;
  const suite = mergeEvaluationSuites(readJson(suitePath), qualityCorpus);
  const manifest = readJson(manifestPath);
  const cases = resolveActualRenderCases(suite, manifest, projectRoot);

  fs.mkdirSync(renderDir, { recursive: true });
  const renderer = path.join(projectRoot, 'src/render-actual-preview.mjs');
  const results = [];
  for (const entry of cases) {
    if (!fs.existsSync(entry.scenePath)) {
      throw new Error(`Actual-render scene not found for ${entry.id}: ${path.relative(projectRoot, entry.scenePath)}`);
    }
    const outputPath = path.join(renderDir, entry.fileName);
    const result = spawnSync(process.execPath, [renderer, entry.scenePath, '-o', outputPath], {
      cwd: projectRoot,
      encoding: 'utf8'
    });
    if ((result.status ?? 1) !== 0) {
      throw new Error(`Actual render failed for ${entry.id}: ${result.stderr || result.stdout || `exit ${result.status}`}`);
    }
    results.push({
      id: entry.id,
      scenePath: path.relative(projectRoot, entry.scenePath),
      fileName: entry.fileName
    });
  }

  return {
    version: '1.0',
    manifestVersion: manifest.version ?? null,
    renderDir: path.relative(projectRoot, renderDir),
    count: results.length,
    results
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--suite') options.suitePath = args[++index];
    else if (arg === '--quality-corpus') options.qualityCorpusPath = args[++index];
    else if (arg === '--manifest') options.manifestPath = args[++index];
    else if (arg === '--render-dir') options.renderDir = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main() {
  const report = renderActualSuite(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`render-actual-suite failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
