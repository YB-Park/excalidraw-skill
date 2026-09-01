#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyQualityPatch } from './quality-patch.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { createQualityReport } from './quality-report.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const sourcePath = path.join(rootDir, 'examples/service-flow/payment-flow.visual-plan.excalidraw');
const outputDir = path.join(rootDir, 'artifacts/patch-scenes');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const cases = [
  {
    id: 'payment-add-audit',
    reviewStatus: 'accepted',
    patch: {
      preserveManualLayout: true,
      operations: [
        {
          op: 'addNode', semanticId: 'audit-store', label: 'Audit Store', shapeRef: 'database.relational',
          near: 'payment-db', side: 'right', gap: 120
        },
        {
          op: 'addEdge', semanticId: 'payment-to-audit', from: 'payment-service', to: 'audit-store',
          label: 'audit', kind: 'writes'
        }
      ]
    }
  },
  {
    id: 'payment-local-edit',
    reviewStatus: 'accepted',
    patch: {
      preserveManualLayout: true,
      operations: [
        { op: 'updateLabel', target: 'card-network', label: 'Card Network / Acquirer' },
        { op: 'moveNear', target: 'settlement-worker', near: 'payment-events', side: 'right', gap: 120 }
      ]
    }
  },
  {
    id: 'payment-insert-auth',
    reviewStatus: 'accepted',
    patch: {
      preserveManualLayout: true,
      operations: [
        {
          op: 'insertNodeBetween', target: 'web-to-gateway', semanticId: 'edge-auth', label: 'Edge Auth',
          shapeRef: 'risk.security', inLabel: 'TLS', outLabel: 'session'
        }
      ]
    }
  },
  {
    id: 'payment-remove-worker',
    reviewStatus: 'accepted',
    patch: { preserveManualLayout: true, operations: [{ op: 'removeObject', target: 'settlement-worker' }] }
  },
  {
    id: 'payment-move-worker-down',
    reviewStatus: 'accepted',
    patch: {
      preserveManualLayout: true,
      operations: [{ op: 'moveNear', target: 'settlement-worker', near: 'payment-events', side: 'down', gap: 80 }]
    }
  },
  {
    id: 'payment-relabel-service',
    reviewStatus: 'accepted',
    patch: {
      preserveManualLayout: true,
      operations: [{ op: 'updateLabel', target: 'payment-service', label: 'Payment Authorization Service' }]
    }
  },
  {
    id: 'payment-rewire-worker',
    reviewStatus: 'accepted',
    patch: {
      preserveManualLayout: true,
      operations: [
        { op: 'removeObject', target: 'events-to-worker' },
        {
          op: 'addEdge', semanticId: 'events-to-worker', from: 'payment-db', to: 'settlement-worker',
          label: 'settle', kind: 'sync'
        }
      ]
    }
  }
];

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Patch review source scene is missing: ${path.relative(rootDir, sourcePath)}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const source = readJson(sourcePath);
  const summaries = [];

  for (const entry of cases) {
    const scene = applyQualityPatch(structuredClone(source), entry.patch);
    const editability = createEditabilityReport(scene);
    const quality = createQualityReport(scene);
    const perceptual = createPerceptualQuality(scene);
    if (!editability.pass || !quality.structuralPass) {
      throw new Error(`${entry.id} failed patch review gates`);
    }
    const scenePath = path.join(outputDir, `${entry.id}.excalidraw`);
    writeJson(scenePath, scene);
    summaries.push({
      id: entry.id,
      reviewStatus: entry.reviewStatus,
      scene: path.relative(rootDir, scenePath),
      patchQuality: scene.customData?.excalidrawSkill?.patchQuality ?? null,
      editabilityMetrics: editability.metrics,
      structuralMetrics: quality.metrics,
      perceptualMetrics: perceptual.metrics,
      perceptualWarnings: perceptual.warnings ?? []
    });
  }

  writeJson(path.join(outputDir, 'summary.json'), {
    version: '0.2.0', source: path.relative(rootDir, sourcePath), cases: summaries
  });
  console.log(JSON.stringify({
    count: summaries.length,
    accepted: summaries.filter((entry) => entry.reviewStatus === 'accepted').length,
    candidates: summaries.filter((entry) => entry.reviewStatus === 'candidate').length,
    outputDir: path.relative(rootDir, outputDir)
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`generate-patch-review-scenes failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
