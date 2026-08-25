#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mergeEvaluationSuites } from './evaluate-suite.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const suitePath = path.join(rootDir, 'examples/evaluation/suite.json');
const qualityCorpusPath = path.join(rootDir, 'examples/evaluation/quality-corpus.json');
const defaultOutputPath = path.join(rootDir, 'examples/evaluation/results/layout-candidates.latest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function run(relativeFile, args) {
  const result = spawnSync(process.execPath, [path.join(rootDir, relativeFile), ...args], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${relativeFile} failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result;
}

function reportPaths(outputPath) {
  return {
    editability: `${outputPath}.editability.json`,
    quality: `${outputPath}.quality.json`,
    perceptual: `${outputPath}.perceptual.json`
  };
}

function readReports(outputPath) {
  const paths = reportPaths(outputPath);
  return {
    editability: readJson(paths.editability),
    quality: readJson(paths.quality),
    perceptual: readJson(paths.perceptual)
  };
}

function compactReports(reports) {
  return {
    pass: reports.editability.pass === true && reports.quality.pass === true,
    editabilityPass: reports.editability.pass === true,
    structuralPass: reports.quality.structuralPass === true,
    familyPass: reports.quality.familyPass === true,
    structuralMetrics: reports.quality.metrics,
    perceptualMetrics: reports.perceptual.metrics,
    perceptualWarnings: reports.perceptual.details?.warnings ?? []
  };
}

function buildCurrent(fixture) {
  const spec = readJson(path.join(rootDir, fixture));
  run('src/build.mjs', [fixture]);
  return compactReports(readReports(path.resolve(rootDir, spec.outputPath)));
}

function buildElkCandidate(fixture, tempDir) {
  const original = readJson(path.join(rootDir, fixture));
  const outputPath = path.join(tempDir, `${path.basename(fixture, '.diagram.json')}.elk.excalidraw`);
  const spec = { ...original, outputPath };
  const specPath = path.join(tempDir, `${path.basename(fixture, '.diagram.json')}.elk.diagram.json`);
  writeJson(specPath, spec);

  run('src/render.mjs', [specPath]);
  run('src/style-by-kind.mjs', [outputPath]);
  run('src/layout-elk-flow.mjs', [outputPath, specPath]);
  run('src/apply-components.mjs', [outputPath]);
  run('src/group-component-details.mjs', [outputPath]);
  run('src/repair-routes.mjs', [outputPath]);
  run('src/simplify-routes.mjs', [outputPath]);
  run('src/style-edges.mjs', [outputPath]);
  run('src/frame-groups.mjs', [outputPath, specPath]);
  run('src/assign-frame-membership.mjs', [outputPath]);
  run('src/label-edges.mjs', [outputPath]);
  run('src/place-edge-labels.mjs', [outputPath, specPath]);
  run('src/apply-fonts.mjs', [outputPath]);
  run('src/editability-report.mjs', [outputPath]);
  run('src/validate.mjs', [outputPath]);
  run('src/quality-report.mjs', [outputPath, specPath]);
  run('src/perceptual-quality-report.mjs', [outputPath, specPath]);
  return compactReports(readReports(outputPath));
}

function chooseWinner(current, elk) {
  if (current.pass && !elk.pass) return { winner: 'current', reason: 'ELK candidate violates hard quality gates' };
  if (!current.pass && elk.pass) return { winner: 'elk', reason: 'ELK candidate restores hard quality gates' };
  if (!current.pass && !elk.pass) return { winner: 'none', reason: 'Neither candidate passes hard quality gates' };
  const currentCost = current.perceptualMetrics.readabilityCost ?? Number.POSITIVE_INFINITY;
  const elkCost = elk.perceptualMetrics.readabilityCost ?? Number.POSITIVE_INFINITY;
  if (elkCost + 0.5 < currentCost) return { winner: 'elk', reason: `lower readability cost (${elkCost} < ${currentCost})` };
  if (currentCost + 0.5 < elkCost) return { winner: 'current', reason: `lower readability cost (${currentCost} < ${elkCost})` };
  const currentWarnings = current.perceptualWarnings.length;
  const elkWarnings = elk.perceptualWarnings.length;
  if (elkWarnings < currentWarnings) return { winner: 'elk', reason: 'fewer perceptual warnings' };
  if (currentWarnings < elkWarnings) return { winner: 'current', reason: 'fewer perceptual warnings' };
  return { winner: 'tie', reason: 'candidate metrics are effectively tied' };
}

export function summarizeComparisons(results) {
  const counts = { current: 0, elk: 0, tie: 0, none: 0 };
  for (const result of results) counts[result.decision.winner] += 1;
  return {
    cases: results.length,
    winners: counts,
    elkHardPasses: results.filter((result) => result.elk.pass).length,
    currentHardPasses: results.filter((result) => result.current.pass).length,
    averageCurrentReadabilityCost: Number((results.reduce((sum, result) => sum + (result.current.perceptualMetrics.readabilityCost ?? 0), 0) / Math.max(1, results.length)).toFixed(2)),
    averageElkReadabilityCost: Number((results.reduce((sum, result) => sum + (result.elk.perceptualMetrics.readabilityCost ?? 0), 0) / Math.max(1, results.length)).toFixed(2))
  };
}

function main() {
  const baseSuite = readJson(suitePath);
  const qualityCorpus = fs.existsSync(qualityCorpusPath) ? readJson(qualityCorpusPath) : null;
  const suite = mergeEvaluationSuites(baseSuite, qualityCorpus);
  const cases = (suite.cases ?? []).filter((entry) => {
    return entry.family === 'flow'
      && entry.implementationStatus !== 'contract-only'
      && entry.fixture;
  });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-layout-lab-'));
  const results = [];
  try {
    for (const entry of cases) {
      const current = buildCurrent(entry.fixture);
      const elk = buildElkCandidate(entry.fixture, tempDir);
      results.push({
        id: entry.id,
        view: entry.view,
        fixture: entry.fixture,
        current,
        elk,
        decision: chooseWinner(current, elk)
      });
    }
    const report = {
      version: '0.2.0',
      generatedAt: new Date().toISOString(),
      mode: 'research-only',
      qualityCorpusVersion: suite.qualityCorpusVersion ?? null,
      summary: summarizeComparisons(results),
      results
    };
    writeJson(defaultOutputPath, report);
    console.log(JSON.stringify({
      outputPath: path.relative(rootDir, defaultOutputPath),
      summary: report.summary,
      decisions: results.map((result) => ({ id: result.id, ...result.decision }))
    }, null, 2));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`evaluate-layout-candidates failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
