#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(file) {
  return fs.existsSync(file);
}

function writeIfMissing(file, content) {
  if (exists(file)) return false;
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
  return true;
}

function main() {
  const created = [];
  const checked = [];

  checked.push('skills/excalidraw-skill/SKILL.md');
  checked.push('.opencode/commands/excalidraw.md');
  checked.push('.github/prompts/excalidraw.prompt.md');

  const opencodeCommand = `---\ndescription: Create or update an Excalidraw software diagram\n---\n\nUse the \`excalidraw-skill\` router skill.\n\nUser request:\n\n$ARGUMENTS\n`;

  const prompt = `# Excalidraw Diagram Prompt\n\nUse the repository skill at skills/excalidraw-skill/SKILL.md as the router.\n`;

  if (writeIfMissing('.opencode/commands/excalidraw.md', opencodeCommand)) created.push('.opencode/commands/excalidraw.md');
  if (writeIfMissing('.github/prompts/excalidraw.prompt.md', prompt)) created.push('.github/prompts/excalidraw.prompt.md');

  console.log(JSON.stringify({ ok: true, checked, created }, null, 2));
}

main();
