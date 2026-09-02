import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('user-facing smoke docs inspect the scene produced by npm run smoke', () => {
  const packageJson = readJson('package.json');
  const smokeCommand = packageJson.scripts?.smoke ?? '';
  const match = smokeCommand.match(/\bbuild\s+([^\s]+)/);
  assert.ok(match, `could not resolve smoke spec from: ${smokeCommand}`);

  const smokeSpec = readJson(match[1]);
  const outputPath = smokeSpec.outputPath;
  assert.ok(outputPath, 'smoke spec must declare outputPath');

  const docs = [
    'README.md',
    'docs/USAGE.md',
    'docs/AGENT_SETUP.md',
    'docs/SMOKE_TEST.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/RENDER_QUALITY.md'
  ];

  for (const relativePath of docs) {
    const content = read(relativePath);
    assert.ok(
      content.includes(outputPath),
      `${relativePath} must reference current smoke output ${outputPath}`
    );
    assert.equal(
      content.includes('payment-flow.grouped.excalidraw'),
      false,
      `${relativePath} still references the legacy grouped smoke output`
    );
  }
});

test('patch usage and installed edit guide list every executable DiagramPatch operation', () => {
  const contract = read('skills/excalidraw-skill/contracts/diagram-patch.md');
  const operations = [...new Set(
    [...contract.matchAll(/- `op: "([^"]+)"`/g)].map((match) => match[1])
  )];

  assert.ok(operations.length >= 8, 'DiagramPatch contract should expose the full operation set');

  for (const relativePath of [
    'docs/PATCH_USAGE.md',
    'skills/excalidraw-skill/guides/edit.md'
  ]) {
    const content = read(relativePath);
    for (const operation of operations) {
      assert.ok(
        content.includes(`\`${operation}\``),
        `${relativePath} is missing DiagramPatch operation ${operation}`
      );
    }
  }
});

test('release docs no longer describe global installation or patching as unimplemented smoke scope', () => {
  const release = read('docs/RELEASE_CHECKLIST.md');
  const patch = read('docs/PATCH_USAGE.md');

  assert.equal(release.includes('Global installation is not part of the first release'), false);
  assert.equal(patch.includes('This is still a smoke-test implementation'), false);
});
