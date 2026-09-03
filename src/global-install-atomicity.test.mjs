import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANAGED_AGENT_FILES, installGlobalSkill } from './global-skill.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function setup(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-global-atomic-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const copilotHome = path.join(home, '.copilot');
  return {
    targetDir: path.join(copilotHome, 'skills', 'excalidraw-skill'),
    runtimeDir: path.join(copilotHome, 'tools', 'excalidraw-skill'),
    agentsDir: path.join(copilotHome, 'agents'),
    mcpConfigPath: path.join(copilotHome, 'mcp-config.json')
  };
}

test('unmanaged MCP conflict leaves agents, skill, runtime, and config untouched', (t) => {
  const targets = setup(t);
  fs.mkdirSync(path.dirname(targets.mcpConfigPath), { recursive: true });
  const original = `${JSON.stringify({ servers: { excalidraw: { command: 'user-owned' }, keep: { command: 'keep' } } }, null, 2)}\n`;
  fs.writeFileSync(targets.mcpConfigPath, original);

  assert.throws(() => installGlobalSkill({ rootDir, ...targets }), /unmanaged MCP server entry/);
  assert.equal(fs.readFileSync(targets.mcpConfigPath, 'utf8'), original);
  assert.equal(fs.existsSync(targets.targetDir), false);
  assert.equal(fs.existsSync(targets.runtimeDir), false);
  for (const name of MANAGED_AGENT_FILES) assert.equal(fs.existsSync(path.join(targets.agentsDir, name)), false);
});

test('unmanaged agent conflict leaves MCP config, skill, and runtime untouched', (t) => {
  const targets = setup(t);
  fs.mkdirSync(targets.agentsDir, { recursive: true });
  fs.writeFileSync(path.join(targets.agentsDir, 'excalidraw-designer.agent.md'), 'user-owned agent\n');
  fs.mkdirSync(path.dirname(targets.mcpConfigPath), { recursive: true });
  const original = `${JSON.stringify({ servers: { keep: { command: 'keep' } } }, null, 2)}\n`;
  fs.writeFileSync(targets.mcpConfigPath, original);

  assert.throws(() => installGlobalSkill({ rootDir, ...targets }), /unmanaged agent file/);
  assert.equal(fs.readFileSync(targets.mcpConfigPath, 'utf8'), original);
  assert.equal(fs.existsSync(targets.targetDir), false);
  assert.equal(fs.existsSync(targets.runtimeDir), false);
  assert.equal(fs.readFileSync(path.join(targets.agentsDir, 'excalidraw-designer.agent.md'), 'utf8'), 'user-owned agent\n');
  for (const name of MANAGED_AGENT_FILES.filter((name) => name !== 'excalidraw-designer.agent.md')) {
    assert.equal(fs.existsSync(path.join(targets.agentsDir, name)), false);
  }
});
