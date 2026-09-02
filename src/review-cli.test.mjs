import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(rootDir, 'bin/excalidraw-skill.mjs');
const pngSignature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

function run(args, cwd) {
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
}

test('review produces verified PNG and explicit visual-review handoff', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-review-'));
  const sourceSpec = JSON.parse(fs.readFileSync(path.join(rootDir, 'examples/service-flow/payment-flow.visual-plan.diagram.json'), 'utf8'));
  sourceSpec.outputPath = path.join(cwd, 'diagram.excalidraw');
  const specPath = path.join(cwd, 'spec.json');
  fs.writeFileSync(specPath, `${JSON.stringify(sourceSpec, null, 2)}\n`);

  const build = run(['build', specPath], cwd);
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const review = run(['review', sourceSpec.outputPath, specPath], cwd);
  assert.equal(review.status, 0, review.stderr || review.stdout);

  const reviewPath = path.join(cwd, 'diagram.review.json');
  const previewPath = path.join(cwd, 'diagram.preview.png');
  assert.ok(fs.existsSync(reviewPath));
  assert.ok(fs.existsSync(previewPath));

  const report = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
  assert.equal(report.ok, true);
  assert.equal(report.previewValidPng, true);
  assert.equal(report.requiresVisualReview, true);
  assert.equal(report.visualApprovalPerformed, false);

  const png = fs.readFileSync(previewPath);
  assert.ok(png.subarray(0, pngSignature.length).equals(pngSignature));
});

test('render refuses PNG output through public CLI', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-render-contract-'));
  const spec = path.join(rootDir, 'examples/service-flow/payment-flow.visual-plan.diagram.json');
  const result = run(['render', spec, '-o', path.join(cwd, 'broken.png')], cwd);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /render writes Excalidraw JSON only/);
  assert.equal(fs.existsSync(path.join(cwd, 'broken.png')), false);
});
