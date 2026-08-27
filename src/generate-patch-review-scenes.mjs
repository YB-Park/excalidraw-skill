#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyQualityPatch } from './quality-patch.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { createQualityReport } from './quality-report.mjs';

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
    patch: {
      preserveManualLayout: true,
      operations: [
        {
          op: 'addNode',
          semanticId: 'audit-store',
          label: 'Audit Store',
          shapeRef: 'database.relational',
          near: 'payment-db',
          side: 'right',
          gap: 120
        },
        {
          op: 'addEdge',
          semanticId: 'payment-to-audit',
          from: 'payment-service',
          to: 'audit-store',
          label: 'audit',
          kind: 'writes'
        }
      ]
    }
  },
  {
    id: 'payment-local-edit',
    patch: {
      preserveManualLayout: true,
      operations: [
        {
          op: 'updateLabel',
          target: 'card-network',
          label: 'Card Network / Acquirer'
        },
        {
          op: 'moveNear',
          target: 'settlement-worker',
          near: 'payment-events',
          side: 'right',
          gap: 120
        }
      ]
    }
  },
  {
    id: 'payment-insert-auth',
    patch: {
      preserveManualLayout: true,
      operations: [
        {
          op: 'insertNodeBetween',
          target: 'web-to-gateway',
          semanticId: 'edge-auth',
          label: 'Edge Auth',
          shapeRef: 'risk.security',
          inLabel: 'TLS',
          outLabel: 'session'
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
    if (!editability.pass || !quality.structuralPass) {
      throw new Error(`${entry.id} failed patch review gates`);
    }
    const scenePath = path.join(outputDir, `${entry.id}.excalidraw`);
    writeJson(scenePath, scene);
    summaries.push({
      id: entry.id,
      scene: path.relative(rootDir, scenePath),
      patchQuality: scene.customData?.excalidrawSkill?.patchQuality ?? null,
      editabilityMetrics: editability.metrics,
      structuralMetrics: quality.metrics
    });
  }

  writeJson(path.join(outputDir, 'summary.json'), {
    version: '0.1.0',
    source: path.relative(rootDir, sourcePath),
    cases: summaries
  });
  console.log(JSON.stringify({ count: summaries.length, outputDir: path.relative(rootDir, outputDir) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`generate-patch-review-scenes failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
