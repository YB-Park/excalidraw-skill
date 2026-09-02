#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { doctorGlobalSkill, installGlobalSkill, uninstallGlobalSkill } from '../src/global-skill.mjs';

const [command = 'help', ...args] = process.argv.slice(2);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const invocationCwd = process.cwd();

const runners = {
  build: 'src/build.mjs',
  review: 'src/review.mjs',
  preview: 'src/export-preview-png.mjs',
  inspect: 'src/inspect-scene.mjs',
  validate: 'src/validate.mjs',
  patch: 'src/quality-patch.mjs',
  init: 'src/init.mjs',
  evaluate: 'src/evaluate-suite.mjs',
  capabilities: 'src/capabilities.mjs',
  schema: 'src/schema.mjs',
  explain: 'src/explain.mjs',
  render: 'src/render.mjs',
  'check-refs': 'src/check-refs.mjs',
  'label-edges': 'src/label-edges.mjs',
  'layout-service-flow': 'src/layout-service-flow.mjs',
  'layout-system-architecture': 'src/layout-system-architecture.mjs',
  'layout-module-architecture': 'src/layout-module-architecture.mjs',
  'quality-report': 'src/quality-report.mjs',
  'editability-report': 'src/editability-report.mjs'
};

const ARG_REQUIRED_COMMANDS = new Set(['build','review','preview','inspect','validate','patch','render','check-refs','label-edges','layout-service-flow','layout-system-architecture','layout-module-architecture','quality-report','editability-report']);
const fromRoot = (relativePath) => path.join(rootDir, relativePath);
const hasFlag = (flag) => args.includes(flag);
const hasHelpFlag = () => args.includes('--help') || args.includes('-h');

function run(file) {
  const result = spawnSync(process.execPath, [fromRoot(file), ...args], { stdio: 'inherit', cwd: invocationCwd });
  process.exit(result.status ?? 1);
}

function printAndExit(message, status = 0, stream = console.log) {
  stream(message);
  process.exit(status);
}

function requireGlobal() {
  if (!hasFlag('--global')) printAndExit('This command requires --global. Use `excalidraw-skill init` for project-local setup.', 1, console.error);
}

function generalHelp() {
  return `Usage: excalidraw-skill <command> [args]\n\nAgent happy paths\n\nNew diagram:\n  1. Write DiagramSpec.\n  2. node <runtimeEntry> build <spec.json>\n  3. node <runtimeEntry> review <output.excalidraw> <spec.json>\n  4. Open the reported preview PNG with image vision and follow the visual-review guide.\n\nExisting diagram edit:\n  1. node <runtimeEntry> inspect <scene.excalidraw>\n  2. Apply the smallest semantic patch.\n  3. node <runtimeEntry> review <output.excalidraw> [spec.json]\n  4. Open the reported preview PNG with image vision.\n\nPrimary commands:\n  build <spec.json>                         Build a new diagram.\n  review <scene.excalidraw> [spec.json]     Run deterministic gates and create a verified PNG for visual review.\n  inspect <scene.excalidraw>                Inspect semantic structure before editing.\n  patch <scene.excalidraw> <patch.json>     Apply a semantic edit.\n  preview <scene.excalidraw> [-o file.png]  Create only a portable PNG preview.\n  capabilities                              Print supported families/features.\n  schema                                    Print the DiagramSpec schema.\n  examples                                  Print compact agent recipes.\n  explain [overview|visual|frames|layout]   Explain an agent-facing concept.\n  init [--upgrade]                          Create or upgrade managed project prompts.\n  doctor [--global]                         Check installation.\n  install --global [--force]                Install managed runtime.\n  uninstall --global [--force]              Remove managed runtime.\n\nLLM rules:\n  - Prefer build/review for new diagrams and inspect/patch/review for edits.\n  - A passing metric report is not aesthetic approval: inspect the PNG when vision is available.\n  - Never use render to create PNG. render is developer-only and writes Excalidraw JSON.\n  - Do not probe multiple --help commands as a discovery loop.\n\nUse: excalidraw-skill help <command>. Developer helpers are listed by: excalidraw-skill help debug.`;
}

function commandHelp(name) {
  const help = {
    build: 'Usage: excalidraw-skill build <spec.json>\n\nBuild a new diagram from DiagramSpec.',
    review: 'Usage: excalidraw-skill review <scene.excalidraw> [spec.json]\n\nRun validate/editability/quality gates, create a PNG with signature verification, and emit review metadata requiring image-based visual review.',
    preview: 'Usage: excalidraw-skill preview <scene.excalidraw> [-o preview.png]\n\nCreate a valid portable PNG for visual review.',
    inspect: 'Usage: excalidraw-skill inspect <scene.excalidraw>\n\nInspect semantic structure before edits.',
    patch: 'Usage: excalidraw-skill patch <scene.excalidraw> <patch.json> [-o output.excalidraw]\n\nApply a semantic patch to an existing scene.',
    init: 'Usage: excalidraw-skill init [--upgrade]\n\nCreate missing project prompts. --upgrade refreshes managed or recognized legacy generated prompts while preserving unmanaged files.',
    render: 'Usage: excalidraw-skill render <spec.json> [-o output.excalidraw]\n\nDeveloper-only low-level renderer. It writes .excalidraw JSON and refuses PNG output.',
    validate: 'Usage: excalidraw-skill validate <scene.excalidraw>',
    'editability-report': 'Usage: excalidraw-skill editability-report <scene.excalidraw> [-o report.json]',
    'quality-report': 'Usage: excalidraw-skill quality-report <scene.excalidraw> [spec.json] [-o report.json]',
    capabilities: 'Usage: excalidraw-skill capabilities',
    schema: 'Usage: excalidraw-skill schema',
    examples: 'Usage: excalidraw-skill examples',
    explain: 'Usage: excalidraw-skill explain [overview|visual|frames|layout]',
    doctor: 'Usage: excalidraw-skill doctor [--global]',
    install: 'Usage: excalidraw-skill install --global [--force]',
    uninstall: 'Usage: excalidraw-skill uninstall --global [--force]',
    evaluate: 'Usage: excalidraw-skill evaluate [--family <family>] [--case <id>] [--no-build]',
    'list-shapes': 'Usage: excalidraw-skill list-shapes',
    debug: 'Developer helpers: render, style-by-kind, layout-service-flow, layout-system-architecture, layout-module-architecture, check-refs, label-edges. Normal agents should not use render for PNG output.'
  };
  return `${help[name] ?? `Unknown command: ${name}\n\n${generalHelp()}`}\n\nLLM rule: follow the happy paths instead of composing developer primitives.`;
}

if (command === 'help' || command === '--help' || command === '-h') printAndExit(command === 'help' && args[0] ? commandHelp(args[0]) : generalHelp());
if (hasHelpFlag()) printAndExit(commandHelp(command));
if (ARG_REQUIRED_COMMANDS.has(command) && args.length === 0) printAndExit(commandHelp(command), 1, console.error);

if (command === 'doctor') {
  if (hasFlag('--global')) {
    const report = doctorGlobalSkill();
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }
  console.log('excalidraw-skill doctor: ok');
  console.log(`node: ${process.version}`);
  console.log(`workspace: ${invocationCwd}`);
} else if (command === 'install') {
  requireGlobal();
  console.log(JSON.stringify(installGlobalSkill({ rootDir, force: hasFlag('--force') }), null, 2));
} else if (command === 'uninstall') {
  requireGlobal();
  console.log(JSON.stringify(uninstallGlobalSkill({ force: hasFlag('--force') }), null, 2));
} else if (command === 'list-shapes') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/catalog/shapes.index.json'), 'utf8'));
} else if (command === 'examples') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/agent-recipes.json'), 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  printAndExit(commandHelp(command), 1, console.error);
}
