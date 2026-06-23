#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  doctorGlobalSkill,
  installGlobalSkill,
  uninstallGlobalSkill
} from '../src/global-skill.mjs';

const [command = 'help', ...args] = process.argv.slice(2);
const binDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(binDir, '..');
const invocationCwd = process.cwd();

const runners = {
  render: 'src/render.mjs',
  inspect: 'src/inspect-scene.mjs',
  validate: 'src/validate.mjs',
  patch: 'src/patch.mjs',
  build: 'src/build.mjs',
  init: 'src/init.mjs',
  evaluate: 'src/evaluate-suite.mjs',
  'check-refs': 'src/check-refs.mjs',
  'label-edges': 'src/label-edges.mjs',
  'layout-service-flow': 'src/layout-service-flow.mjs',
  'layout-system-architecture': 'src/layout-system-architecture.mjs',
  'layout-module-architecture': 'src/layout-module-architecture.mjs',
  'quality-report': 'src/quality-report.mjs'
};

const ARG_REQUIRED_COMMANDS = new Set([
  'build',
  'render',
  'inspect',
  'validate',
  'patch',
  'check-refs',
  'label-edges',
  'layout-service-flow',
  'layout-system-architecture',
  'layout-module-architecture',
  'quality-report'
]);

function fromRoot(relativePath) {
  return path.join(rootDir, relativePath);
}

function run(file) {
  const result = spawnSync(process.execPath, [fromRoot(file), ...args], {
    stdio: 'inherit',
    cwd: invocationCwd
  });
  process.exit(result.status ?? 1);
}

function hasFlag(flag) {
  return args.includes(flag);
}

function hasHelpFlag(values = args) {
  return values.includes('--help') || values.includes('-h');
}

function requireGlobal() {
  if (!hasFlag('--global')) {
    console.error('This command requires --global. Use `excalidraw-skill init` for project-local setup.');
    process.exit(1);
  }
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function generalHelp() {
  return `Usage: excalidraw-skill <command> [args]

Agent-first recipes

New diagram, no existing .excalidraw path:
  1. Write a DiagramSpec JSON file in the workspace.
  2. Set spec.outputPath to the desired .excalidraw path.
  3. Run: node <runtimeEntry> build <spec.json>
  4. Run: node <runtimeEntry> inspect <output.excalidraw>
  5. Run: node <runtimeEntry> quality-report <output.excalidraw> <spec.json>
  6. Return the output path and quality summary.

Existing diagram edit, existing .excalidraw path provided:
  1. Run: node <runtimeEntry> inspect <scene.excalidraw>
  2. Write a DiagramPatch JSON file using the inspected semantic ids.
  3. Run: node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
  4. Run: node <runtimeEntry> validate <output.excalidraw>
  5. Run: node <runtimeEntry> quality-report <output.excalidraw> [spec.json]

Primary commands:
  build <spec.json>                         Build a new diagram from DiagramSpec.
  inspect <scene.excalidraw>                Summarize semantic nodes and edges.
  validate <scene.excalidraw>               Check basic Excalidraw file validity.
  quality-report <scene.excalidraw> [spec]  Check structural and family quality.
  patch <scene.excalidraw> <patch.json>     Apply a semantic patch to an existing scene.
  init                                      Create project-local prompt entrypoints.
  doctor [--global]                         Check local or global installation.
  install --global [--force]                Install global skill and managed runtime.
  uninstall --global [--force]              Remove managed global skill and runtime.
  evaluate [--family <family>]              Run the evaluation suite.
  list-shapes                               Print the shape catalog index.

Internal/debug commands:
  render, layout-service-flow, layout-system-architecture,
  layout-module-architecture, route/label/style helpers.

Rules for LLM agents:
  - For new diagrams, prefer build. Do not call patch.
  - Use patch only after inspecting an existing .excalidraw file.
  - Do not call render directly unless debugging the renderer pipeline.
  - Do not repeatedly probe --help during normal diagram generation; follow the recipes above.
  - PATH installation is optional. The installed skill should use node <runtimeEntry> ... directly.

Use: excalidraw-skill help <command> for command-specific help.`;
}

function commandHelp(name) {
  const commonFooter = '\n\nLLM rule: follow the router recipes instead of probing multiple --help commands.';
  const help = {
    build: `Usage: excalidraw-skill build <spec.json>

Build a new diagram from a DiagramSpec file. This is the default command for new diagram requests.

Expected flow:
  node <runtimeEntry> build diagrams/example.diagram.json
  node <runtimeEntry> inspect diagrams/example.excalidraw
  node <runtimeEntry> quality-report diagrams/example.excalidraw diagrams/example.diagram.json

Do not use patch for a new diagram.`,
    render: `Usage: excalidraw-skill render <spec.json> [-o output.excalidraw]

Low-level renderer step. Most agents should not call this directly.

For new diagrams, use:
  node <runtimeEntry> build <spec.json>

build runs render plus styling, family layout, routing, validation, and quality-report generation.`,
    inspect: `Usage: excalidraw-skill inspect <scene.excalidraw>

Read an existing generated scene and print semantic nodes and edges.

Use inspect before writing a DiagramPatch for an existing diagram edit.`,
    validate: `Usage: excalidraw-skill validate <scene.excalidraw>

Checks basic Excalidraw file validity only. A passing validate result is not a quality approval.

For diagram quality, also run:
  node <runtimeEntry> quality-report <scene.excalidraw> [spec.json]`,
    patch: `Usage: excalidraw-skill patch <scene.excalidraw> <patch.json> [-o output.excalidraw]

Patch is only for editing an existing .excalidraw scene.

Required edit flow:
  node <runtimeEntry> inspect <scene.excalidraw>
  # write DiagramPatch using semantic ids from inspect
  node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
  node <runtimeEntry> validate <output.excalidraw>

For a new diagram, do not call patch. Write a DiagramSpec and run build instead.`,
    'quality-report': `Usage: excalidraw-skill quality-report <scene.excalidraw> [spec.json] [-o report.json]

Checks structural quality and, when spec.json is provided, family-specific invariants.

Treat pass as structural evidence, not aesthetic approval. Review the rendered scene visually when possible.`,
    init: `Usage: excalidraw-skill init

Create project-local prompt entrypoints in the current workspace:
  .opencode/commands/excalidraw.md
  .github/prompts/excalidraw.prompt.md

init does not install anything into ~/.copilot.`,
    doctor: `Usage: excalidraw-skill doctor [--global]

Without --global, prints basic local runtime information.
With --global, checks the installed skill bundle and managed runtime.

Global success requires skillOk and runtimeOk. cliOk is optional.`,
    install: `Usage: excalidraw-skill install --global [--force]

Install the global Copilot skill bundle and user-owned managed runtime.
This does not require npm install -g or sudo by default.`,
    uninstall: `Usage: excalidraw-skill uninstall --global [--force]

Remove the managed global skill bundle and managed runtime.
Unmanaged directories are not removed unless --force is supplied.`,
    evaluate: `Usage: excalidraw-skill evaluate [--family <family>] [--case <id>] [--no-build]

Run the evaluation suite and write examples/evaluation/results/latest.json by default.`,
    'list-shapes': `Usage: excalidraw-skill list-shapes

Print the shape catalog index for selecting semantic shapeRef values.`
  };
  return (help[name] ?? `Unknown command: ${name}\n\n${generalHelp()}`) + commonFooter;
}

function printAndExit(message, status = 0, stream = console.log) {
  stream(message);
  process.exit(status);
}

if (command === 'help' || command === '--help' || command === '-h') {
  const topic = command === 'help' ? args[0] : null;
  printAndExit(topic ? commandHelp(topic) : generalHelp(), 0);
}

if (hasHelpFlag()) {
  printAndExit(commandHelp(command), 0);
}

if (ARG_REQUIRED_COMMANDS.has(command) && args.length === 0) {
  printAndExit(commandHelp(command), 1, console.error);
}

if (command === 'doctor') {
  if (hasFlag('--global')) {
    const report = doctorGlobalSkill();
    printResult(report);
    process.exit(report.ok ? 0 : 1);
  }
  console.log('excalidraw-skill doctor: ok');
  console.log(`node: ${process.version}`);
  console.log(`workspace: ${invocationCwd}`);
} else if (command === 'install') {
  requireGlobal();
  printResult(installGlobalSkill({ rootDir, force: hasFlag('--force') }));
} else if (command === 'uninstall') {
  requireGlobal();
  printResult(uninstallGlobalSkill({ force: hasFlag('--force') }));
} else if (command === 'list-shapes') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/catalog/shapes.index.json'), 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  printAndExit(commandHelp(command), 1, console.error);
}
