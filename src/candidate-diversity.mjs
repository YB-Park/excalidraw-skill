#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

export function semanticCenters(scene) {
  const result = new Map();
  for (const element of scene?.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role !== 'node' || typeof meta.semanticId !== 'string') continue;
    result.set(meta.semanticId, {
      x: Number(element.x) + Number(element.width) / 2,
      y: Number(element.y) + Number(element.height) / 2
    });
  }
  return result;
}

function normalizedPositions(centers, ids) {
  const xs = ids.map((id) => centers.get(id).x);
  const ys = ids.map((id) => centers.get(id).y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const positions = new Map(ids.map((id) => [id, {
    x: (centers.get(id).x - minX) / width,
    y: (centers.get(id).y - minY) / height
  }]));
  return { positions, width, height };
}

export function compareCandidateScenes(leftScene, rightScene) {
  const leftCenters = semanticCenters(leftScene);
  const rightCenters = semanticCenters(rightScene);
  const ids = [...leftCenters.keys()].filter((id) => rightCenters.has(id)).sort();
  if (ids.length < 2) throw new Error('Candidate diversity comparison requires at least two shared semantic nodes');
  const left = normalizedPositions(leftCenters, ids);
  const right = normalizedPositions(rightCenters, ids);
  const squared = ids.reduce((sum, id) => {
    const a = left.positions.get(id);
    const b = right.positions.get(id);
    return sum + ((a.x - b.x) ** 2) + ((a.y - b.y) ** 2);
  }, 0);
  const normalizedRms = Math.sqrt(squared / ids.length);
  const widthRatio = Math.max(left.width, right.width) / Math.max(1, Math.min(left.width, right.width));
  const heightRatio = Math.max(left.height, right.height) / Math.max(1, Math.min(left.height, right.height));
  return {
    sharedNodes: ids.length,
    normalizedRms: Number(normalizedRms.toFixed(4)),
    widthRatio: Number(widthRatio.toFixed(4)),
    heightRatio: Number(heightRatio.toFixed(4))
  };
}

export function isMeaningfullyDistinct(metrics, {
  minNormalizedRms = 0.12,
  minAxisRatio = 1.08
} = {}) {
  return metrics.normalizedRms >= minNormalizedRms
    || metrics.widthRatio >= minAxisRatio
    || metrics.heightRatio >= minAxisRatio;
}

export function evaluateCandidateDiversity(manifest, { readScene } = {}) {
  const reader = readScene ?? ((scenePath) => JSON.parse(fs.readFileSync(scenePath, 'utf8')));
  const candidates = manifest?.candidates ?? [];
  if (candidates.length < 2) throw new Error('Candidate diversity requires at least two candidates');
  const comparisons = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const left = candidates[i];
      const right = candidates[j];
      const metrics = compareCandidateScenes(reader(left.scenePath), reader(right.scenePath));
      comparisons.push({
        left: left.strategy,
        right: right.strategy,
        ...metrics,
        distinct: isMeaningfullyDistinct(metrics)
      });
    }
  }
  return {
    ok: comparisons.every((entry) => entry.distinct),
    comparisons
  };
}

function main() {
  const [manifestPath] = process.argv.slice(2);
  if (!manifestPath) {
    console.error('Usage: candidate-diversity <candidates.json>');
    process.exit(1);
  }
  const absoluteManifest = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absoluteManifest, 'utf8'));
  const report = evaluateCandidateDiversity(manifest);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error('Candidate portfolio is not compositionally diverse enough for perceptual ranking.');
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
