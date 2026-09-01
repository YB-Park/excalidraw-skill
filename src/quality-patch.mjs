#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyQualityPatch as applyBaseQualityPatch } from './quality-patch-base.mjs';
import { improvePatchRoutes } from './patch-route-portfolio.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { createQualityReport } from './quality-report.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function compactFailure(editability, quality) {
  return {
    editabilityPass: editability.pass,
    structuralPass: quality.structuralPass,
    editabilityMetrics: editability.metrics,
    structuralMetrics: quality.metrics,
    suggestedPatches: quality.suggestedPatches
  };
}

export function applyQualityPatch(scene, patch, options = {}) {
  const strict = options.strict !== false;
  applyBaseQualityPatch(scene, patch, { ...options, strict: false });

  const patchQuality = scene.customData?.excalidrawSkill?.patchQuality ?? {};
  const affectedEdges = new Set(patchQuality.affectedEdges ?? []);
  const routePortfolio = improvePatchRoutes(scene, affectedEdges);
  const editability = createEditabilityReport(scene);
  const quality = createQualityReport(scene);

  if (strict && (!editability.pass || !quality.structuralPass)) {
    throw new Error(`Patched scene failed quality gates: ${JSON.stringify(compactFailure(editability, quality))}`);
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.patchQuality = {
    ...patchQuality,
    version: '0.4.0',
    routePortfolio,
    editabilityPass: editability.pass,
    structuralPass: quality.structuralPass
  };
  return scene;
}

export function runQualityPatchCli() {
  const [scenePathArg, patchPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !patchPathArg) {
    console.error('Usage: node src/quality-patch.mjs <scene.excalidraw> <patch.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const patchPath = path.resolve(process.cwd(), patchPathArg);
  const scene = readJson(scenePath);
  const patch = readJson(patchPath);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : path.resolve(process.cwd(), patch.outputPath ?? scenePathArg);
  writeJson(outputPath, applyQualityPatch(scene, patch));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runQualityPatchCli();
  } catch (error) {
    console.error(`patch failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
