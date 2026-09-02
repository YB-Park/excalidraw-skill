import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = path.join(root, '.github/agents');
const cheapModels = [
  'GPT-5.6 Luna (copilot)',
  'MAI-Code-1.1-Flash (copilot)',
  'Kimi K2.7 Code (copilot)'
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function frontmatterModels(content) {
  const match = content.match(/\nmodel:\n([\s\S]*?)\n(?:[a-zA-Z-]+:|---)/);
  assert.ok(match, 'agent must declare an explicit model policy');
  return [...match[1].matchAll(/^\s+-\s+(.+)$/gm)].map((entry) => entry[1].trim());
}

test('all Excalidraw agents explicitly restrict themselves to the cheap model allow-list', () => {
  const files = fs.readdirSync(agentDir).filter((name) => name.startsWith('excalidraw-') && name.endsWith('.agent.md'));
  assert.equal(files.length, 3);
  for (const file of files) {
    const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
    const models = frontmatterModels(content);
    assert.ok(models.length >= 1, `${file} must declare at least one model`);
    for (const model of models) assert.ok(cheapModels.includes(model), `${file} uses non-cheap model ${model}`);
    assert.match(content, /Never request a more expensive model/i);
  }
});

test('critic prioritizes an image-capable cheap model and requires actual image inspection', () => {
  const critic = read('.github/agents/excalidraw-critic.agent.md');
  assert.equal(frontmatterModels(critic)[0], 'MAI-Code-1.1-Flash (copilot)');
  assert.match(critic, /diagram_review_image/);
  assert.match(critic, /image was not actually returned and inspected/i);
});

test('designer uses subagents and semantic MCP tools rather than raw render orchestration', () => {
  const designer = read('.github/agents/excalidraw-designer.agent.md');
  assert.match(designer, /Excalidraw Planner/);
  assert.match(designer, /Excalidraw Critic/);
  assert.match(designer, /diagram_candidates/);
  assert.doesNotMatch(designer, /render\s+.*\.png/i);
});

test('portable MCP workspace config points to the local semantic server', () => {
  const config = JSON.parse(read('.mcp.json'));
  assert.equal(config.servers.excalidraw.type, 'stdio');
  assert.equal(config.servers.excalidraw.command, 'node');
  assert.deepEqual(config.servers.excalidraw.args, ['mcp/server.mjs']);
});

test('MCP server exposes image review and layout-state tools', () => {
  const server = read('mcp/server.mjs');
  for (const tool of [
    'diagram_candidates',
    'diagram_review_image',
    'diagram_validate',
    'diagram_capture_layout_state',
    'diagram_apply_layout_state'
  ]) assert.match(server, new RegExp(`['\"]${tool}['\"]`));
  assert.match(server, /type: 'image'/);
  assert.match(server, /mimeType: 'image\/png'/);
});
