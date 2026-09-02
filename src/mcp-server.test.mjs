import test from 'node:test';
import assert from 'node:assert/strict';
import { createExcalidrawMcpServer } from '../mcp/server.mjs';

test('MCP server constructs with typed Excalidraw tool registrations', () => {
  const server = createExcalidrawMcpServer();
  assert.ok(server);
  assert.equal(typeof server.connect, 'function');
});
