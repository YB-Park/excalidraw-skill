#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const defaultSuitePath = 'examples/evaluation/suite.json';
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
    else if (arg === '-o' || arg === '--output') options.outputPath = args[++index] ?? defaultOutputPath;
    else if (arg === '--no-build') options.build = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
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
  return {
    total: results.length,
    runnable: runnable.length,
    passed,
    failed,
    contractOnly,
    missingFixture,
    pass: failed === 0 && missingFixture === 0
  };
}

function runBuild(fixturePath) {
  return spawnSync(process.execPath, [path.join(rootDir, 'src/build.mjs'), fixturePath], {
    cwd: rootDir,
    encoding: 'utf8'
  });
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
  const qualityPath = `${outputPath}.quality.json`;
  if (!fs.existsSync(qualityPath)) {
    return {
      id: entry.id,
      family: entry.family,
      view: entry.view,
      status: 'failed',
      fixture: entry.fixture,
      phase: 'quality-report',
      reason: `Quality report not found: ${path.relative(rootDir, qualityPath)}`,
      stdout: buildResult?.stdout ?? '',
      stderr: buildResult?.stderr ?? ''
    };
  }

  const quality = readJson(qualityPath);
  return {
    id: entry.id,
    family: entry.family,
    view: entry.view,
    status: quality.pass ? 'passed' : 'failed',
    fixture: entry.fixture,
    outputPath: spec.outputPath,
    qualityPath: path.relative(rootDir, qualityPath),
    structuralPass: quality.structuralPass,
    familyPass: quality.familyPass,
    supported: quality.familyQuality?.supported ?? true,
    reason: quality.familyQuality?.reason ?? null,
    metrics: quality.metrics,
    suggestedPatches: quality.suggestedPatches
  };
}

export function evaluateSuite(suite, options = {}) {
  const selected = selectCases(suite, options);
  const results = selected.map((entry) => evaluateCase(entry, options.build !== false));
  return {
    version: '1.0',
    suiteVersion: suite.version ?? null,
    generatedAt: new Date().toISOString(),
    filters: {
      family: options.family ?? null,
      caseId: options.caseId ?? null,
      build: options.build !== false
    },
    summary: summarizeResults(results),
    results
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const suitePath = path.resolve(rootDir, options.suitePath);
  const outputPath = path.resolve(rootDir, options.outputPath);
  const report = evaluateSuite(readJson(suitePath), options);
  writeJson(outputPath, report);
  console.log(JSON.stringify({
    outputPath: path.relative(rootDir, outputPath),
    summary: report.summary
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
