import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createExcalidrawMcpServer, workspacePath } from '../mcp/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedTools = [
  'diagram_apply_layout_state',
  'diagram_candidates',
  'diagram_capture_layout_state',
  'diagram_review_image',
  'diagram_validate'
];

test('MCP server constructs with typed Excalidraw tool registrations', () => {
  const server = createExcalidrawMcpServer();
  assert.ok(server);
  assert.equal(typeof server.connect, 'function');
});

test('MCP path resolution rejects workspace escapes', () => {
  assert.equal(workspacePath('diagrams/example.excalidraw', root), path.join(root, 'diagrams/example.excalidraw'));
  assert.throws(() => workspacePath('../outside.txt', root), /escapes workspace/i);
});

test('MCP stdio server negotiates, lists semantic tools, and executes a real tool call', async () => {
  const tempDir = fs.mkdtempSync(path.join(root, '.tmp-excalidraw-mcp-test-'));
  const scenePath = path.join(tempDir, 'empty.excalidraw');
  const layoutStatePath = path.join(tempDir, 'captured.layout-state.json');
  fs.writeFileSync(scenePath, `${JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} })}\n`);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'mcp/server.mjs')],
    cwd: root,
    stderr: 'pipe'
  });
  const client = new Client(
    { name: 'excalidraw-mcp-integration-test', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } }
  );

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), expectedTools);

    const result = await client.callTool({
      name: 'diagram_capture_layout_state',
      arguments: { scenePath, outputPath: layoutStatePath }
    });
    assert.notEqual(result.isError, true);
    assert.equal(fs.existsSync(layoutStatePath), true);
    const state = JSON.parse(fs.readFileSync(layoutStatePath, 'utf8'));
    assert.equal(state.version, '1.0');
    assert.deepEqual(state.nodes, {});
  } finally {
    await client.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
