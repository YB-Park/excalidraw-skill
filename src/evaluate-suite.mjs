#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const defaultSuitePath = 'examples/evaluation/suite.json';
const defaultQualityCorpusPath = 'examples/evaluation/quality-corpus.json';
const defaultReadabilityBaselinePath = 'examples/evaluation/readability-baseline.json';
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
    readabilityBaselinePath: defaultReadabilityBaselinePath,
    includeQualityCorpus: true,
    outputPath: defaultOutputPath,
    family: null,
    caseId: null,
    build: true,
    strictPerceptual: false,
    strictReadability: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--family') options.family = args[++index] ?? null;
    else if (arg === '--case') options.caseId = args[++index] ?? null;
    else if (arg === '--suite') options.suitePath = args[++index] ?? defaultSuitePath;
    else if (arg === '--quality-corpus') options.qualityCorpusPath = args[++index] ?? defaultQualityCorpusPath;
    else if (arg === '--readability-baseline') options.readabilityBaselinePath = args[++index] ?? defaultReadabilityBaselinePath;
    else if (arg === '--no-quality-corpus') options.includeQualityCorpus = false;
    else if (arg === '-o' || arg === '--output') options.outputPath = args[++index] ?? defaultOutputPath;
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--strict-perceptual') options.strictPerceptual = true;
    else if (arg === '--strict-readability') options.strictReadability = true;
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

export function applyReadabilityBudgets(results, baseline = null) {
  if (!baseline) return results;
  const defaultTolerance = Number(baseline.defaultTolerance ?? 0);
  if (!Number.isFinite(defaultTolerance) || defaultTolerance < 0) {
    throw new Error('Readability baseline defaultTolerance must be a non-negative number');
  }
  const cases = baseline.cases ?? {};
  return results.map((result) => {
    if (result.status !== 'passed' && result.status !== 'failed') return result;
    const baselineCost = cases[result.id];
    const currentCost = result.perceptualMetrics?.readabilityCost;
    const readabilityBaselineMissing = !Number.isFinite(baselineCost);
    const readabilityMetricMissing = !Number.isFinite(currentCost);
    const readabilityBudget = readabilityBaselineMissing ? null : Number((baselineCost + defaultTolerance).toFixed(4));
    const readabilityDelta = readabilityBaselineMissing || readabilityMetricMissing
      ? null
      : Number((currentCost - baselineCost).toFixed(4));
    const readabilityRegression = !readabilityBaselineMissing
      && (readabilityMetricMissing || currentCost > readabilityBudget + 1e-9);
    return {
      ...result,
      readabilityBaseline: readabilityBaselineMissing ? null : baselineCost,
      readabilityTolerance: defaultTolerance,
      readabilityBudget,
      readabilityDelta,
      readabilityBaselineMissing,
      readabilityMetricMissing,
      readabilityRegression
    };
  });
}

export function summarizeResults(results, options = {}) {
  const runnable = results.filter((result) => result.status === 'passed' || result.status === 'failed');
  const passed = runnable.filter((result) => result.status === 'passed').length;
  const failed = runnable.filter((result) => result.status === 'failed').length;
  const contractOnly = results.filter((result) => result.status === 'contract-only').length;
  const missingFixture = results.filter((result) => result.status === 'missing-fixture').length;
  const perceptualWarnings = runnable.reduce((sum, result) => sum + (result.perceptualWarnings?.length ?? 0), 0);
  const readabilityRegressions = runnable.filter((result) => result.readabilityRegression === true).length;
  const missingReadabilityBaselines = runnable.filter((result) => result.readabilityBaselineMissing === true).length;
  const missingReadabilityMetrics = runnable.filter((result) => result.readabilityMetricMissing === true).length;
  const structuralPass = failed === 0 && missingFixture === 0;
  const perceptualPass = perceptualWarnings === 0;
  const readabilityPass = readabilityRegressions === 0
    && missingReadabilityBaselines === 0
    && missingReadabilityMetrics === 0;
  const strictPerceptual = options.strictPerceptual === true;
  const strictReadability = options.strictReadability === true;
  return {
    total: results.length,
    runnable: runnable.length,
    passed,
    failed,
    contractOnly,
    missingFixture,
    perceptualWarnings,
    readabilityRegressions,
    missingReadabilityBaselines,
    missingReadabilityMetrics,
    structuralPass,
    perceptualPass,
    readabilityPass,
    strictPerceptual,
    strictReadability,
    pass: structuralPass
      && (!strictPerceptual || perceptualPass)
      && (!strictReadability || readabilityPass)
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
  const rawResults = selected.map((entry) => evaluateCase(entry, options.build !== false));
  const results = applyReadabilityBudgets(rawResults, options.readabilityBaseline ?? null);
  return {
    version: '1.5',
    suiteVersion: suite.version ?? null,
    qualityCorpusVersion: suite.qualityCorpusVersion ?? null,
    readabilityBaselineVersion: options.readabilityBaseline?.version ?? null,
    generatedAt: new Date().toISOString(),
    filters: {
      family: options.family ?? null,
      caseId: options.caseId ?? null,
      build: options.build !== false,
      qualityCorpus: options.includeQualityCorpus !== false,
      strictPerceptual: options.strictPerceptual === true,
      strictReadability: options.strictReadability === true
    },
    summary: summarizeResults(results, options),
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
    readabilityBaseline: result.readabilityBaseline ?? null,
    readabilityBudget: result.readabilityBudget ?? null,
    readabilityDelta: result.readabilityDelta ?? null,
    readabilityRegression: result.readabilityRegression ?? null,
    suggestedPatches: result.suggestedPatches ?? null
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const suitePath = path.resolve(rootDir, options.suitePath);
  const qualityCorpusPath = path.resolve(rootDir, options.qualityCorpusPath);
  const readabilityBaselinePath = path.resolve(rootDir, options.readabilityBaselinePath);
  const outputPath = path.resolve(rootDir, options.outputPath);
  const qualityCorpus = options.includeQualityCorpus && fs.existsSync(qualityCorpusPath)
    ? readJson(qualityCorpusPath)
    : null;
  if (options.strictReadability && !fs.existsSync(readabilityBaselinePath)) {
    throw new Error(`Strict readability baseline not found: ${path.relative(rootDir, readabilityBaselinePath)}`);
  }
  options.readabilityBaseline = fs.existsSync(readabilityBaselinePath)
    ? readJson(readabilityBaselinePath)
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
  const readabilityReview = report.results
    .filter((result) => result.status === 'passed'
      && (result.readabilityRegression || result.readabilityBaselineMissing || result.readabilityMetricMissing))
    .map((result) => ({
      id: result.id,
      family: result.family,
      view: result.view,
      readabilityCost: result.perceptualMetrics?.readabilityCost ?? null,
      baseline: result.readabilityBaseline,
      tolerance: result.readabilityTolerance,
      budget: result.readabilityBudget,
      delta: result.readabilityDelta,
      baselineMissing: result.readabilityBaselineMissing,
      metricMissing: result.readabilityMetricMissing,
      regression: result.readabilityRegression
    }));
  console.log(JSON.stringify({
    outputPath: path.relative(rootDir, outputPath),
    summary: report.summary,
    failedCases,
    perceptualReview,
    readabilityReview
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
