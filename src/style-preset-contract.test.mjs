import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_STYLE_PRESET, loadStylePreset } from './style-preset.mjs';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function jsonFilesUnder(relativeDir) {
  const root = path.join(rootDir, relativeDir);
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return jsonFilesUnder(relative);
    return entry.isFile() && entry.name.endsWith('.json') ? [relative] : [];
  });
}

test('professional-software is the implicit runtime preset', () => {
  assert.equal(DEFAULT_STYLE_PRESET, 'professional-software');
  assert.equal(loadStylePreset().name, 'professional-software');
});

test('DiagramSpec v2 makes stylePreset optional and constrains explicit values', () => {
  const schema = readJson('skills/excalidraw-skill/contracts/diagram-spec-v2.schema.json');
  assert.equal(schema.required.includes('stylePreset'), false);
  assert.equal(schema.properties.stylePreset.const, 'professional-software');
  assert.equal(schema.properties.stylePreset.default, 'professional-software');
});

test('agent-facing examples do not teach the invented default-software name', () => {
  const files = [
    'skills/excalidraw-skill/agent-recipes.json',
    ...jsonFilesUnder('examples/evaluation/fixtures')
  ];
  for (const relativePath of files) {
    assert.equal(
      read(relativePath).includes('"stylePreset": "default-software"'),
      false,
      `${relativePath} teaches the unsupported default-software preset`
    );
  }
});

test('unsupported preset errors tell agents how to recover', () => {
  assert.throws(
    () => loadStylePreset('default-software'),
    /Unsupported style preset: default-software\. Use professional-software, or omit stylePreset to use the default\./
  );
});
