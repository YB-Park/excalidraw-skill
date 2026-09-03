import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { installGlobalSkill } from './global-skill.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedTools = [
  'diagram_apply_layout_state',
  'diagram_candidates',
  'diagram_capture_layout_state',
  'diagram_review_image',
  'diagram_validate'
];

test('globally installed MCP runtime negotiates and exposes semantic tools', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-global-mcp-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const copilotHome = path.join(home, '.copilot');
  const targetDir = path.join(copilotHome, 'skills', 'excalidraw-skill');
  const runtimeDir = path.join(copilotHome, 'tools', 'excalidraw-skill');
  const agentsDir = path.join(copilotHome, 'agents');
  const mcpConfigPath = path.join(copilotHome, 'mcp-config.json');

  installGlobalSkill({
    rootDir,
    targetDir,
    runtimeDir,
    agentsDir,
    mcpConfigPath,
    nodeExecutable: process.execPath
  });

  const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  const server = config.servers.excalidraw;
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    cwd: home,
    stderr: 'pipe'
  });
  const client = new Client(
    { name: 'global-install-mcp-test', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } }
  );
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), expectedTools);
  } finally {
    await client.close();
  }
});
