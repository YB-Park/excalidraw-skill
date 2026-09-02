#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upgrade = process.argv.slice(2).includes('--upgrade');
const generatedMarker = '<!-- excalidraw-skill-generated:v1 -->';

const entries = [
  {
    target: '.opencode/commands/excalidraw.md',
    template: '.opencode/commands/excalidraw.md',
    legacySignatures: [
      'description: Create or update an Excalidraw software diagram',
      'Do not use low-level `render` directly for normal generation.',
      'After generation or edit, report the `.excalidraw` output path and quality summary.'
    ]
  },
  {
    target: '.github/prompts/excalidraw.prompt.md',
    template: '.github/prompts/excalidraw.prompt.md',
    legacySignatures: [
      '# Excalidraw Diagram Prompt',
      'Do not call low-level `render` directly for normal generation.',
      'After generation, report the `.excalidraw` path and the quality result.'
    ]
  }
];

function templateContent(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function isManagedOrLegacy(content, entry) {
  if (content.includes(generatedMarker)) return true;
  return entry.legacySignatures.every((signature) => content.includes(signature));
}

function syncEntry(entry) {
  const desired = templateContent(entry.template);
  const target = path.resolve(process.cwd(), entry.target);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, desired);
    return 'created';
  }

  const current = fs.readFileSync(target, 'utf8');
  if (current === desired) return 'current';
  if (!upgrade) return 'preserved';
  if (!isManagedOrLegacy(current, entry)) return 'preserved-unmanaged';

  fs.writeFileSync(target, desired);
  return 'upgraded';
}

const results = Object.fromEntries(entries.map((entry) => [entry.target, syncEntry(entry)]));
console.log(JSON.stringify({
  ok: true,
  upgrade,
  checked: entries.map((entry) => entry.target),
  results,
  created: Object.entries(results).filter(([, status]) => status === 'created').map(([file]) => file),
  upgraded: Object.entries(results).filter(([, status]) => status === 'upgraded').map(([file]) => file)
}, null, 2));
