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
  patch: 'src/quality-patch.mjs',
  build: 'src/build.mjs',
  init: 'src/init.mjs',
  evaluate: 'src/evaluate-suite.mjs',
  capabilities: 'src/capabilities.mjs',
  schema: 'src/schema.mjs',
  explain: 'src/explain.mjs',
  'check-refs': 'src/check-refs.mjs',
  'label-edges': 'src/label-edges.mjs',
  'layout-service-flow': 'src/layout-service-flow.mjs',
  'layout-system-architecture': 'src/layout-system-architecture.mjs',
  'layout-module-architecture': 'src/layout-module-architecture.mjs',
  'quality-report': 'src/quality-report.mjs',
  'editability-report': 'src/editability-report.mjs'
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
  'quality-report',
  'editability-report'
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
  5. Read the generated editability and quality reports.
  6. Return the output path and quality summary.

Existing diagram edit, existing .excalidraw path provided:
  1. Run: node <runtimeEntry> inspect <scene.excalidraw>
  2. Write a DiagramPatch JSON file using the inspected semantic ids.
  3. Run: node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
  4. Run: node <runtimeEntry> editability-report <output.excalidraw>
  5. Run: node <runtimeEntry> validate <output.excalidraw>
  6. Run: node <runtimeEntry> quality-report <output.excalidraw> [spec.json]

Primary commands:
  build <spec.json>                         Build a new diagram from DiagramSpec.
  inspect <scene.excalidraw>                Summarize semantic nodes, edges, frames, and edit warnings.
  validate <scene.excalidraw>               Check basic Excalidraw file validity.
  editability-report <scene.excalidraw>     Check native text, arrow, frame, and group editability.
  quality-report <scene.excalidraw> [spec]  Check structural and family quality.
  patch <scene.excalidraw> <patch.json>     Apply a semantic patch to an existing scene.
  capabilities                              Print supported families/profiles/features.
  schema                                    Print the DiagramSpec v2 JSON schema.
  examples                                  Print compact agent recipe snippets.
  explain [overview|visual|frames|layout]   Explain one agent-facing concept.
  init                                      Create project-local prompt entrypoints.
  doctor [--global]                         Check local or global installation.
  install --global [--force]                Install global skill and managed runtime.
  uninstall --global [--force]              Remove managed global skill and runtime.
  evaluate [--family <family>]              Run the evaluation suite.
  list-shapes                               Print the shape catalog index.

Rules for LLM agents:
  - For normal discovery, use capabilities, schema, examples, and explain.
  - For new diagrams, prefer build. Do not call patch.
  - Use patch only after inspecting an existing .excalidraw file.
  - Treat editability failures as release blockers.
  - Do not call render directly unless debugging the renderer pipeline.
  - Do not repeatedly probe --help during normal diagram generation; follow the recipes above.
  - PATH installation is optional. The installed skill should use node <runtimeEntry> ... directly.

Use: excalidraw-skill help <command> for command-specific help.
Use: excalidraw-skill help debug for developer helper commands.`;
}

function commandHelp(name) {
  const commonFooter = '\n\nLLM rule: follow the router recipes instead of probing multiple --help commands.';
  const help = {
    build: `Usage: excalidraw-skill build <spec.json>\n\nBuild a new diagram from a DiagramSpec file. Build now gates native editability before validation and quality reporting.`,
    render: `Usage: excalidraw-skill render <spec.json> [-o output.excalidraw]\n\nDeveloper renderer step. For new diagrams, use build instead.`,
    inspect: `Usage: excalidraw-skill inspect <scene.excalidraw>\n\nRead an existing generated scene and print semantic nodes, edges, frames, layout hints, and editability warnings.`,
    validate: `Usage: excalidraw-skill validate <scene.excalidraw>\n\nChecks basic Excalidraw file validity only. Use editability-report and quality-report for usable diagram quality.`,
    patch: `Usage: excalidraw-skill patch <scene.excalidraw> <patch.json> [-o output.excalidraw]\n\nPatch is only for editing an existing .excalidraw scene. Patch output is re-routed locally and must pass editability and structural quality gates.`,
    'editability-report': `Usage: excalidraw-skill editability-report <scene.excalidraw> [-o report.json]\n\nChecks native Excalidraw container bindings, arrow bindings, frame membership, and generated component grouping.`,
    'quality-report': `Usage: excalidraw-skill quality-report <scene.excalidraw> [spec.json] [-o report.json]\n\nChecks structural quality, family invariants, and intent preservation.`,
    capabilities: `Usage: excalidraw-skill capabilities\n\nPrint a compact JSON capability map for supported families, profiles, visual intent, frame policy, and quality checks.`,
    schema: `Usage: excalidraw-skill schema\n\nPrint the DiagramSpec v2 JSON schema.`,
    examples: `Usage: excalidraw-skill examples\n\nPrint compact agent recipe snippets for common diagram intents.`,
    explain: `Usage: excalidraw-skill explain [overview|visual|frames|layout]\n\nPrint a concise explanation of one agent-facing concept.`,
    init: `Usage: excalidraw-skill init\n\nCreate project-local prompt entrypoints in the current workspace.`,
    doctor: `Usage: excalidraw-skill doctor [--global]\n\nWithout --global, prints basic local runtime information. With --global, checks the installed skill bundle and managed runtime.`,
    install: `Usage: excalidraw-skill install --global [--force]\n\nInstall the global Copilot skill bundle and user-owned managed runtime.`,
    uninstall: `Usage: excalidraw-skill uninstall --global [--force]\n\nRemove the managed global skill bundle and managed runtime.`,
    evaluate: `Usage: excalidraw-skill evaluate [--family <family>] [--case <id>] [--no-build]\n\nRun the evaluation suite.`,
    'list-shapes': `Usage: excalidraw-skill list-shapes\n\nPrint the shape catalog index for selecting semantic shapeRef values.`,
    debug: `Developer helper commands:\n  render\n  style-by-kind\n  layout-service-flow\n  layout-system-architecture\n  layout-module-architecture\n  check-refs\n  label-edges\n\nNormal agents should prefer build, inspect, patch, editability-report, quality-report, capabilities, schema, examples, and explain.`
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
} else if (command === 'examples') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/agent-recipes.json'), 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  printAndExit(commandHelp(command), 1, console.error);
}
