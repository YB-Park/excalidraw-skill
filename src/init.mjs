#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

const created = [];
const checked = [
  '.opencode/commands/excalidraw.md',
  '.github/prompts/excalidraw.prompt.md'
];

const opencodeCommand = [
  '---',
  'description: Create or update an Excalidraw software diagram',
  '---',
  '',
  'Use the excalidraw-skill router. Prefer a project-local skill when present; otherwise use the globally installed skill.',
  '',
  'User request:',
  '',
  '$ARGUMENTS',
  ''
].join('\n');

const prompt = [
  '# Excalidraw Diagram Prompt',
  '',
  'Use the excalidraw-skill router. Prefer a project-local skill when present; otherwise use the globally installed skill.',
  ''
].join('\n');

if (writeIfMissing('.opencode/commands/excalidraw.md', opencodeCommand)) {
  created.push('.opencode/commands/excalidraw.md');
}
if (writeIfMissing('.github/prompts/excalidraw.prompt.md', prompt)) {
  created.push('.github/prompts/excalidraw.prompt.md');
}

console.log(JSON.stringify({ ok: true, checked, created }, null, 2));
