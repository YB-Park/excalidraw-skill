import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderSpec } from './render.mjs';
import { createEditabilityReport } from './editability-report.mjs';
import { createQualityReport } from './quality-report.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

test('CLI patch command uses the quality-aware round-trip pipeline', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-patch-cli-'));
  try {
    const scenePath = path.join(tempDir, 'scene.excalidraw');
    const patchPath = path.join(tempDir, 'patch.json');
    const outputPath = path.join(tempDir, 'patched.excalidraw');
    const scene = renderSpec({
      diagramType: 'service-flow',
      stylePreset: 'professional-software',
      nodes: [
        { semanticId: 'client', label: 'Client', shapeRef: 'client.web' },
        { semanticId: 'service', label: 'Service', shapeRef: 'service.backend' }
      ],
      edges: [
        { semanticId: 'client-service', from: 'client', to: 'service', label: 'call', kind: 'calls' }
      ]
    });
    writeJson(scenePath, scene);
    writeJson(patchPath, {
      operations: [
        { op: 'addNode', semanticId: 'store', label: 'Store', shapeRef: 'database.relational', near: 'service', side: 'down', gap: 90 },
        { op: 'addEdge', semanticId: 'service-store', from: 'service', to: 'store', label: 'persist', kind: 'writes' }
      ]
    });

    const result = spawnSync(process.execPath, [
      path.join(rootDir, 'bin/excalidraw-skill.mjs'),
      'patch', scenePath, patchPath, '-o', outputPath
    ], {
      cwd: tempDir,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(outputPath), true);

    const patched = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(patched.customData?.excalidrawSkill?.patchQuality?.editabilityPass, true);
    assert.equal(patched.customData?.excalidrawSkill?.patchQuality?.structuralPass, true);
    assert.equal(createEditabilityReport(patched).pass, true);
    assert.equal(createQualityReport(patched).structuralPass, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
