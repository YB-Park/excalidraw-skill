#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const defaultSuitePath = 'examples/evaluation/suite.json';
const defaultQualityCorpusPath = 'examples/evaluation/quality-corpus.json';
const defaultOutputPath = 'examples/evaluation/results/latest.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(args) {
  const options = {
    suitePath: defaultSuitePath,
    qualityCorpusPath: defaultQualityCorpusPath,
    includeQualityCorpus: true,
    outputPath: defaultOutputPath,
    family: null,
    caseId: null,
    build: true
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--family') options.family = args[++index] ?? null;
    else if (arg === '--case') options.caseId = args[++index] ?? null;
    else if (arg === '--suite') options.suitePath = args[++index] ?? defaultSuitePath;
    else if (arg === '--quality-corpus') options.qualityCorpusPath = args[++index] ?? defaultQualityCorpusPath;
    else if (arg === '--no-quality-corpus') options.includeQualityCorpus = false;
    else if (arg === '-o' || arg === '--output') options.outputPath = args[++index] ?? defaultOutputPath;
    else if (arg === '--no-build') options.build = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function mergeEvaluationSuites(baseSuite, qualityCorpus = null) {
  if (!qualityCorpus) return baseSuite;
  const baseCases = baseSuite.cases ?? [];
  const qualityCases = qualityCorpus.cases ?? [];
  const existingIds = new Set(baseCases.map((entry) => entry.id));
  const dedupedQualityCases = qualityCases.filter((entry) => !existingIds.has(entry.id));
  return {
    ...baseSuite,
    qualityCorpusVersion: qualityCorpus.version ?? null,
    cases: [...baseCases, ...dedupedQualityCases]
  };
}

export function selectCases(suite, options = {}) {
  return (suite.cases ?? []).filter((entry) => {
    if (options.family && entry.family !== options.family) return false;
    if (options.caseId && entry.id !== options.caseId) return false;
    return true;
  });
}

export function summarizeResults(results) {
  const runnable = results.filter((result) => result.status === 'passed' || result.status === 'failed');
  const passed = runnable.filter((result) => result.status === 'passed').length;
  const failed = runnable.filter((result) => result.status === 'failed').length;
  const contractOnly = results.filter((result) => result.status === 'contract-only').length;
  const missingFixture = results.filter((result) => result.status === 'missing-fixture').length;
  const perceptualWarnings = runnable.reduce((sum, result) => sum + (result.perceptualWarnings?.length ?? 0), 0);
  return {
    total: results.length,
    runnable: runnable.length,
    passed,
    failed,
    contractOnly,
    missingFixture,
    perceptualWarnings,
    pass: failed === 0 && missingFixture === 0
  };
}

function runBuild(fixturePath) {
  return spawnSync(process.execPath, [path.join(rootDir, 'src/build.mjs'), fixturePath], {
    cwd: rootDir,
    encoding: 'utf8'
  });
}

function missingReport(entry, fixture, phase, reportPath, buildResult) {
  return {
    id: entry.id,
    family: entry.family,
    view: entry.view,
    status: 'failed',
    fixture,
    phase,
    reason: `${phase} not found: ${path.relative(rootDir, reportPath)}`,
    stdout: buildResult?.stdout ?? '',
    stderr: buildResult?.stderr ?? ''
  };
}

function evaluateCase(entry, build) {
  if (entry.implementationStatus === 'contract-only' || !entry.fixture) {
    return {
      id: entry.id,
      family: entry.family,
      view: entry.view,
      status: 'contract-only',
      fixture: entry.fixture ?? null,
      reason: entry.statusReason ?? 'Dedicated renderer or fixture is not implemented yet.'
    };
  }

  const fixturePath = path.resolve(rootDir, entry.fixture);
  if (!fs.existsSync(fixturePath)) {
    return {
      id: entry.id,
      family: entry.family,
      view: entry.view,
      status: 'missing-fixture',
      fixture: entry.fixture
    };
  }

  const spec = readJson(fixturePath);
  let buildResult = null;
  if (build) {
    buildResult = runBuild(entry.fixture);
    if ((buildResult.status ?? 1) !== 0) {
      return {
        id: entry.id,
        family: entry.family,
        view: entry.view,
        status: 'failed',
        fixture: entry.fixture,
        phase: 'build',
        exitCode: buildResult.status,
        stdout: buildResult.stdout,
        stderr: buildResult.stderr
      };
    }
  }

  const outputPath = path.resolve(rootDir, spec.outputPath);
  const editabilityPath = `${outputPath}.editability.json`;
  const qualityPath = `${outputPath}.quality.json`;
  const perceptualPath = `${outputPath}.perceptual.json`;
  if (!fs.existsSync(editabilityPath)) return missingReport(entry, entry.fixture, 'editability-report', editabilityPath, buildResult);
  if (!fs.existsSync(qualityPath)) return missingReport(entry, entry.fixture, 'quality-report', qualityPath, buildResult);
  if (!fs.existsSync(perceptualPath)) return missingReport(entry, entry.fixture, 'perceptual-quality-report', perceptualPath, buildResult);

  const editability = readJson(editabilityPath);
  const quality = readJson(qualityPath);
  const perceptual = readJson(perceptualPath);
  const pass = editability.pass === true && quality.pass === true;
  return {
    id: entry.id,
    family: entry.family,
    view: entry.view,
    status: pass ? 'passed' : 'failed',
    fixture: entry.fixture,
    outputPath: spec.outputPath,
    editabilityPath: path.relative(rootDir, editabilityPath),
    qualityPath: path.relative(rootDir, qualityPath),
    perceptualPath: path.relative(rootDir, perceptualPath),
    editabilityPass: editability.pass === true,
    structuralPass: quality.structuralPass,
    familyPass: quality.familyPass,
    perceptualMode: perceptual.mode,
    supported: quality.familyQuality?.supported ?? true,
    reason: quality.familyQuality?.reason ?? null,
    editabilityMetrics: editability.metrics,
    metrics: quality.metrics,
    perceptualMetrics: perceptual.metrics,
    perceptualWarnings: perceptual.details?.warnings ?? [],
    suggestedPatches: [
      ...(quality.suggestedPatches ?? []),
      ...(perceptual.suggestedPatches ?? [])
    ]
  };
}

export function evaluateSuite(suite, options = {}) {
  const selected = selectCases(suite, options);
  const results = selected.map((entry) => evaluateCase(entry, options.build !== false));
  return {
    version: '1.3',
    suiteVersion: suite.version ?? null,
    qualityCorpusVersion: suite.qualityCorpusVersion ?? null,
    generatedAt: new Date().toISOString(),
    filters: {
      family: options.family ?? null,
      caseId: options.caseId ?? null,
      build: options.build !== false,
      qualityCorpus: options.includeQualityCorpus !== false
    },
    summary: summarizeResults(results),
    results
  };
}

function compactFailure(result) {
  return {
    id: result.id,
    family: result.family,
    view: result.view,
    phase: result.phase ?? 'quality',
    editabilityPass: result.editabilityPass ?? null,
    structuralPass: result.structuralPass ?? null,
    familyPass: result.familyPass ?? null,
    reason: result.reason ?? null,
    editabilityMetrics: result.editabilityMetrics ?? null,
    metrics: result.metrics ?? null,
    perceptualMetrics: result.perceptualMetrics ?? null,
    perceptualWarnings: result.perceptualWarnings ?? null,
    suggestedPatches: result.suggestedPatches ?? null
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const suitePath = path.resolve(rootDir, options.suitePath);
  const qualityCorpusPath = path.resolve(rootDir, options.qualityCorpusPath);
  const outputPath = path.resolve(rootDir, options.outputPath);
  const qualityCorpus = options.includeQualityCorpus && fs.existsSync(qualityCorpusPath)
    ? readJson(qualityCorpusPath)
    : null;
  const suite = mergeEvaluationSuites(readJson(suitePath), qualityCorpus);
  const report = evaluateSuite(suite, options);
  writeJson(outputPath, report);
  const failedCases = report.results
    .filter((result) => result.status === 'failed' || result.status === 'missing-fixture')
    .map(compactFailure);
  const perceptualReview = report.results
    .filter((result) => result.status === 'passed' && (result.perceptualWarnings?.length ?? 0) > 0)
    .map((result) => ({
      id: result.id,
      family: result.family,
      view: result.view,
      perceptualMetrics: result.perceptualMetrics,
      warnings: result.perceptualWarnings
    }));
  console.log(JSON.stringify({
    outputPath: path.relative(rootDir, outputPath),
    summary: report.summary,
    failedCases,
    perceptualReview
  }, null, 2));
  process.exit(report.summary.pass ? 0 : 1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`evaluate-suite failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
