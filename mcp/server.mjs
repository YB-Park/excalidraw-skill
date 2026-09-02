#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { generateCandidates } from '../src/generate-candidates.mjs';
import { captureLayoutState, applyLayoutState } from '../src/layout-state.mjs';

const mcpDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(mcpDir, '..');

export function workspacePath(inputPath, cwd = process.cwd()) {
  const workspaceRoot = path.resolve(cwd);
  const resolved = path.resolve(workspaceRoot, inputPath);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`MCP path escapes workspace: ${inputPath}`);
  }
  return resolved;
}

function readJson(inputPath) {
  return JSON.parse(fs.readFileSync(workspacePath(inputPath), 'utf8'));
}

function writeJson(inputPath, value) {
  const output = workspacePath(inputPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
}

function runNode(relativeFile, args) {
  const result = spawnSync(process.execPath, [path.join(rootDir, relativeFile), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${relativeFile} failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout.trim();
}

function textAndStructured(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value
  };
}

export function createExcalidrawMcpServer() {
  const server = new McpServer(
    { name: 'excalidraw-cognitive-kernel', version: '0.1.0' },
    {
      instructions: [
        'Use diagram_candidates only for currently supported flow-family candidate exploration instead of inventing coordinates.',
        'Treat validate/editability as hard constraints and visual judgment as a separate perceptual step.',
        'Use diagram_review_image to obtain the actual PNG before claiming visual approval.',
        'Human layout edits are presentation intent: capture them with diagram_capture_layout_state and preserve them.',
        'All paths are restricted to the current workspace.'
      ].join(' ')
    }
  );

  server.registerTool(
    'diagram_candidates',
    {
      description: 'For flow-family DiagramSpecs only, build three deterministic layout-strategy candidates and verified PNG previews. Use blindCandidates for critic handoff; strategy metadata is coordinator-only.',
      inputSchema: z.object({ specPath: z.string().min(1) })
    },
    async ({ specPath }) => textAndStructured(generateCandidates(workspacePath(specPath)))
  );

  server.registerTool(
    'diagram_review_image',
    {
      description: 'Run deterministic review gates and return the actual portable PNG as MCP image content for perceptual inspection.',
      inputSchema: z.object({
        scenePath: z.string().min(1),
        specPath: z.string().min(1).optional()
      })
    },
    async ({ scenePath, specPath }) => {
      const scene = workspacePath(scenePath);
      const args = specPath ? [scene, workspacePath(specPath)] : [scene];
      runNode('src/review.mjs', args);
      const base = scene.slice(0, -'.excalidraw'.length);
      const review = readJson(`${base}.review.json`);
      const png = fs.readFileSync(workspacePath(`${base}.preview.png`));
      return {
        content: [
          { type: 'text', text: JSON.stringify(review, null, 2) },
          { type: 'image', data: png.toString('base64'), mimeType: 'image/png' }
        ],
        structuredContent: review
      };
    }
  );

  server.registerTool(
    'diagram_validate',
    {
      description: 'Run hard validation and editability/quality reports. This is a correctness gate, not a taste score.',
      inputSchema: z.object({
        scenePath: z.string().min(1),
        specPath: z.string().min(1).optional()
      })
    },
    async ({ scenePath, specPath }) => {
      const scene = workspacePath(scenePath);
      runNode('src/validate.mjs', [scene]);
      runNode('src/editability-report.mjs', [scene]);
      runNode('src/quality-report.mjs', specPath ? [scene, workspacePath(specPath)] : [scene]);
      return textAndStructured({
        ok: true,
        scenePath: scene,
        editabilityPath: `${scene}.editability.json`,
        qualityPath: `${scene}.quality.json`
      });
    }
  );

  server.registerTool(
    'diagram_capture_layout_state',
    {
      description: 'Capture human presentation positions by stable semantic node ID.',
      inputSchema: z.object({
        scenePath: z.string().min(1),
        outputPath: z.string().min(1).optional()
      })
    },
    async ({ scenePath, outputPath }) => {
      const scene = workspacePath(scenePath);
      const output = workspacePath(outputPath ?? `${scene}.layout-state.json`);
      const state = captureLayoutState(readJson(scene));
      writeJson(output, state);
      return textAndStructured({ ok: true, scenePath: scene, layoutStatePath: output, state });
    }
  );

  server.registerTool(
    'diagram_apply_layout_state',
    {
      description: 'Reapply locked human presentation positions to matching semantic nodes. Review afterward before approval.',
      inputSchema: z.object({
        scenePath: z.string().min(1),
        layoutStatePath: z.string().min(1)
      })
    },
    async ({ scenePath, layoutStatePath }) => {
      const scene = workspacePath(scenePath);
      const result = applyLayoutState(readJson(scene), readJson(workspacePath(layoutStatePath)));
      writeJson(scene, result.scene);
      return textAndStructured({ ok: true, scenePath: scene, moves: result.moves, requiresFreshReview: true });
    }
  );

  return server;
}

async function main() {
  console.error('Excalidraw cognitive kernel MCP server running on stdio');
  await serveStdio(() => createExcalidrawMcpServer());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
