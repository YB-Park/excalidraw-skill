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
  'Use the `excalidraw-skill` router skill.',
  '',
  'User request:',
  '',
  '$ARGUMENTS',
  '',
  'Rules:',
  '',
  '- Read only the guide needed for this task.',
  '- Decide whether this is a new diagram or an existing diagram edit before running commands.',
  '- If no existing `.excalidraw` file is provided, this is a new diagram: write a `DiagramSpec` and run `node <runtimeEntry> build <spec.json>`.',
  '- For existing diagrams, inspect first and use `DiagramPatch`.',
  '- Do not run `patch` for a new diagram.',
  '- Do not use low-level `render` directly for normal generation.',
  '- Do not probe `render --help`, `validate --help`, or `patch --help` as a discovery loop.',
  '- After generation or edit, report the `.excalidraw` output path and quality summary.',
  ''
].join('\n');

const prompt = [
  '# Excalidraw Diagram Prompt',
  '',
  'Use this prompt when the user asks for an Excalidraw software diagram from VS Code or Copilot Chat.',
  '',
  'Use the repository skill at `skills/excalidraw-skill/SKILL.md` as the router. If a globally installed skill is available, read its router and use its marker-provided `runtimeEntry`.',
  '',
  '## Request',
  '',
  "Use the user's message as the diagram request.",
  '',
  '## Required agent behavior',
  '',
  '- Read only the task guide needed for the current request.',
  '- Resolve whether this is a new diagram or an edit before running commands.',
  '- If the user did not provide an existing `.excalidraw` file, treat the request as a new diagram.',
  '- For a new diagram, follow `guides/create.md`, write a `DiagramSpec`, and run:',
  '',
  '```text',
  'node <runtimeEntry> build <spec.json>',
  '```',
  '',
  '- For an existing diagram edit, follow `guides/edit.md`, run `inspect` first, then write and apply a `DiagramPatch`.',
  '- For visual polish, inspect the existing scene first, then follow `guides/style.md`.',
  '- Do not call `patch` for a new diagram.',
  '- Do not call low-level `render` directly for normal generation.',
  '- Do not probe `render --help`, `validate --help`, or `patch --help` as a discovery loop. Follow the router recipes.',
  '- Use catalog shape refs and style presets.',
  '- After generation, report the `.excalidraw` path and the quality result.',
  ''
].join('\n');

if (writeIfMissing('.opencode/commands/excalidraw.md', opencodeCommand)) {
  created.push('.opencode/commands/excalidraw.md');
}
if (writeIfMissing('.github/prompts/excalidraw.prompt.md', prompt)) {
  created.push('.github/prompts/excalidraw.prompt.md');
}

console.log(JSON.stringify({ ok: true, checked, created }, null, 2));
