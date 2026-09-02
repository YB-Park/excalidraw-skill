#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isPngBuffer } from './export-preview-png.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(srcDir, script), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `${script} failed\n`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const [sceneArg, specArg] = process.argv.slice(2);
  if (!sceneArg) {
    console.error('Usage: node src/review.mjs <scene.excalidraw> [spec.json]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), sceneArg);
  if (path.extname(scenePath).toLowerCase() !== '.excalidraw') {
    console.error('review input must be a .excalidraw scene');
    process.exit(1);
  }
  const base = scenePath.slice(0, -'.excalidraw'.length);
  const editabilityPath = `${base}.editability.json`;
  const qualityPath = `${base}.quality.json`;
  const previewPath = `${base}.preview.png`;
  const reviewPath = `${base}.review.json`;

  run('validate.mjs', [scenePath]);
  run('editability-report.mjs', [scenePath, '-o', editabilityPath]);
  run('quality-report.mjs', specArg ? [scenePath, path.resolve(process.cwd(), specArg), '-o', qualityPath] : [scenePath, '-o', qualityPath]);
  run('export-preview-png.mjs', [scenePath, '-o', previewPath]);

  const png = fs.readFileSync(previewPath);
  if (!isPngBuffer(png)) {
    console.error('review failed: preview output is not a valid PNG');
    process.exit(1);
  }

  const report = {
    ok: true,
    scenePath,
    editabilityPath,
    qualityPath,
    previewPath,
    previewValidPng: true,
    requiresVisualReview: true,
    visualApprovalPerformed: false,
    visualReviewGuide: 'skills/excalidraw-skill/guides/visual-review.md'
  };
  fs.writeFileSync(reviewPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, reviewPath }, null, 2));
}

main();
