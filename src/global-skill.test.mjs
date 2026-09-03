import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INSTALL_MARKER,
  MANAGED_AGENT_FILES,
  RUNTIME_MARKER,
  doctorGlobalSkill,
  installGlobalSkill,
  resolveGlobalAgentsDir,
  resolveGlobalMcpConfigPath,
  resolveGlobalRuntimeDir,
  resolveGlobalSkillDir,
  uninstallGlobalSkill
} from './global-skill.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-skill-global-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function targets(t) {
  const home = tempDir(t);
  const copilotHome = path.join(home, '.copilot');
  return {
    home,
    copilotHome,
    targetDir: path.join(copilotHome, 'skills', 'excalidraw-skill'),
    runtimeDir: path.join(copilotHome, 'tools', 'excalidraw-skill'),
    agentsDir: path.join(copilotHome, 'agents'),
    mcpConfigPath: path.join(copilotHome, 'mcp-config.json')
  };
}

function normalizeMarkdown(text) {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')}\n`;
}

test('installs a self-contained global skill, runtime, agents, and MCP server', (t) => {
  const { targetDir, runtimeDir, agentsDir, mcpConfigPath } = targets(t);
  const nodeExecutable = '/test/node';
  const result = installGlobalSkill({
    rootDir,
    targetDir,
    runtimeDir,
    agentsDir,
    mcpConfigPath,
    nodeExecutable,
    installedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(result.installed, true);
  assert.equal(result.replaced, false);
  for (const relative of [
    'SKILL.md',
    'guides/create.md',
    'guides/visual-review.md',
    'contracts/diagram-spec.md',
    'diagram-types/sequence.md',
    'docs/DIAGRAM_TYPES.md',
    'docs/QUALITY_CRITERIA.md',
    INSTALL_MARKER
  ]) {
    assert.equal(fs.existsSync(path.join(targetDir, relative)), true, relative);
  }
  for (const relative of [
    'bin/excalidraw-skill.mjs',
    'src/build.mjs',
    'src/export-preview-png.mjs',
    'src/global-skill.mjs',
    'mcp/server.mjs',
    'node_modules/@resvg/resvg-js/index.js',
    'node_modules/@modelcontextprotocol/server/package.json',
    'node_modules/zod/package.json',
    'package.json',
    RUNTIME_MARKER
  ]) {
    assert.equal(fs.existsSync(path.join(runtimeDir, relative)), true, relative);
  }
  for (const name of MANAGED_AGENT_FILES) {
    assert.equal(fs.existsSync(path.join(agentsDir, name)), true, name);
    assert.equal(
      fs.readFileSync(path.join(agentsDir, name), 'utf8'),
      fs.readFileSync(path.join(rootDir, '.github', 'agents', name), 'utf8')
    );
  }
  const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  assert.deepEqual(config.servers.excalidraw, {
    type: 'stdio',
    command: nodeExecutable,
    args: [path.join(runtimeDir, 'mcp', 'server.mjs')]
  });
  const marker = JSON.parse(fs.readFileSync(path.join(targetDir, INSTALL_MARKER), 'utf8'));
  assert.equal(marker.runtimeDir, runtimeDir);
  assert.equal(marker.runtimeEntry, path.join(runtimeDir, 'bin', 'excalidraw-skill.mjs'));
  assert.equal(marker.agentsDir, agentsDir);
  assert.equal(marker.mcpConfigPath, mcpConfigPath);

  const report = doctorGlobalSkill({
    rootDir,
    targetDir,
    runtimeDir,
    agentsDir,
    mcpConfigPath,
    nodeExecutable,
    checkCli: false
  });
  assert.equal(report.ok, true);
  assert.equal(report.skillOk, true);
  assert.equal(report.runtimeOk, true);
  assert.equal(report.agentsOk, true);
  assert.equal(report.mcpOk, true);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.runtimeMissing, []);
  assert.deepEqual(report.agentMissing, []);
});

test('global MCP install preserves unrelated user configuration and uninstall removes only ours', (t) => {
  const { targetDir, runtimeDir, agentsDir, mcpConfigPath } = targets(t);
  fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
  fs.writeFileSync(mcpConfigPath, JSON.stringify({
    inputs: [{ id: 'keep-me', type: 'promptString', description: 'Keep' }],
    servers: {
      otherServer: { type: 'stdio', command: 'other', args: ['server.mjs'] }
    }
  }, null, 2));
  installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath, nodeExecutable: '/test/node' });
  const installed = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  assert.ok(installed.servers.excalidraw);
  assert.deepEqual(installed.servers.otherServer, { type: 'stdio', command: 'other', args: ['server.mjs'] });
  assert.equal(installed.inputs[0].id, 'keep-me');

  const removed = uninstallGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath, nodeExecutable: '/test/node' });
  assert.equal(removed.removedMcp, true);
  const after = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  assert.equal(after.servers.excalidraw, undefined);
  assert.deepEqual(after.servers.otherServer, { type: 'stdio', command: 'other', args: ['server.mjs'] });
  assert.equal(after.inputs[0].id, 'keep-me');
});

test('does not overwrite user-owned agent files or MCP entries without force', (t) => {
  const { targetDir, runtimeDir, agentsDir, mcpConfigPath } = targets(t);
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'excalidraw-designer.agent.md'), 'user agent\n');
  assert.throws(
    () => installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath }),
    /unmanaged agent file/
  );
  fs.rmSync(agentsDir, { recursive: true, force: true });
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
  fs.writeFileSync(mcpConfigPath, JSON.stringify({ servers: { excalidraw: { command: 'custom' } } }, null, 2));
  assert.throws(
    () => installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath }),
    /unmanaged MCP server entry/
  );
});

test('reinstall atomically replaces both managed directories', (t) => {
  const { targetDir, runtimeDir, agentsDir, mcpConfigPath } = targets(t);
  installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath });
  fs.writeFileSync(path.join(targetDir, 'stale-skill.txt'), 'stale');
  fs.writeFileSync(path.join(runtimeDir, 'stale-runtime.txt'), 'stale');
  const result = installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath });
  assert.equal(result.replaced, true);
  assert.equal(result.replacedSkill, true);
  assert.equal(result.replacedRuntime, true);
  assert.equal(fs.existsSync(path.join(targetDir, 'stale-skill.txt')), false);
  assert.equal(fs.existsSync(path.join(runtimeDir, 'stale-runtime.txt')), false);
});

test('does not overwrite unmanaged skill or runtime directories without force', (t) => {
  const { targetDir, runtimeDir, agentsDir, mcpConfigPath } = targets(t);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'user-file.txt'), 'keep');
  assert.throws(
    () => installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath }),
    /unmanaged directory/
  );
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, 'user-runtime.txt'), 'keep');
  assert.throws(
    () => installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath }),
    /unmanaged directory/
  );
  installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath, force: true });
  assert.equal(fs.existsSync(path.join(runtimeDir, 'user-runtime.txt')), false);
});

test('uninstalls managed directories, agents, and MCP by default', (t) => {
  const { targetDir, runtimeDir, agentsDir, mcpConfigPath } = targets(t);
  installGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath });
  const removed = uninstallGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath });
  assert.equal(removed.removed, true);
  assert.equal(removed.removedSkill, true);
  assert.equal(removed.removedRuntime, true);
  assert.equal(removed.removedAgents, true);
  assert.equal(removed.removedMcp, true);
  assert.equal(fs.existsSync(targetDir), false);
  assert.equal(fs.existsSync(runtimeDir), false);
  for (const name of MANAGED_AGENT_FILES) assert.equal(fs.existsSync(path.join(agentsDir, name)), false);
  assert.equal(fs.existsSync(mcpConfigPath), false);
  assert.equal(uninstallGlobalSkill({ rootDir, targetDir, runtimeDir, agentsDir, mcpConfigPath }).removed, false);
});

test('resolves COPILOT_HOME and explicit target overrides', () => {
  const options = { env: { COPILOT_HOME: '/tmp/copilot-home' }, homeDir: '/unused' };
  assert.equal(resolveGlobalSkillDir(options), path.resolve('/tmp/copilot-home/skills/excalidraw-skill'));
  assert.equal(resolveGlobalRuntimeDir(options), path.resolve('/tmp/copilot-home/tools/excalidraw-skill'));
  assert.equal(resolveGlobalAgentsDir(options), path.resolve('/tmp/copilot-home/agents'));
  assert.equal(resolveGlobalMcpConfigPath(options), path.resolve('/tmp/copilot-home/mcp-config.json'));
  assert.equal(
    resolveGlobalSkillDir({ env: { EXCALIDRAW_SKILL_GLOBAL_DIR: '/tmp/custom-skill' }, homeDir: '/unused' }),
    path.resolve('/tmp/custom-skill')
  );
  assert.equal(
    resolveGlobalRuntimeDir({ env: { EXCALIDRAW_SKILL_RUNTIME_DIR: '/tmp/custom-runtime' }, homeDir: '/unused' }),
    path.resolve('/tmp/custom-runtime')
  );
});

test('bundled docs stay synchronized with repository docs', () => {
  for (const name of ['DIAGRAM_TYPES.md', 'QUALITY_CRITERIA.md']) {
    const bundled = fs.readFileSync(path.join(rootDir, 'skills', 'excalidraw-skill', 'docs', name), 'utf8');
    const repository = fs.readFileSync(path.join(rootDir, 'docs', name), 'utf8');
    assert.equal(
      normalizeMarkdown(bundled),
      normalizeMarkdown(repository),
      `${name} content differs between repository docs and the bundled skill`
    );
  }
});
