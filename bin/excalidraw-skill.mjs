#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { doctorGlobalSkill, installGlobalSkill, uninstallGlobalSkill } from '../src/global-skill.mjs';
import {
  doctorVscodeUserMcp,
  registerVscodeUserMcp,
  removeVscodeMcpMarker
} from '../src/vscode-mcp-registration.mjs';

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
  return `Usage: excalidraw-skill <command> [args]\n\nAgent-first recipes\n\nNew diagram, no existing .excalidraw path:\n  1. Write a DiagramSpec JSON file in the workspace.\n  2. Set spec.outputPath to the desired .excalidraw path.\n  3. Run: node <runtimeEntry> build <spec.json>\n  4. Run: node <runtimeEntry> review <output.excalidraw> <spec.json>\n  5. review runs validate/editability/quality checks and creates a verified PNG.\n  6. Compatibility path: node <runtimeEntry> preview <output.excalidraw> -o <preview.png>\n  7. Visually inspect the preview when the host supports image vision.\n  8. Do not call patch for a brand-new diagram; refine the spec and rebuild.\n\nExisting diagram edit, existing .excalidraw path provided:\n  1. Run: node <runtimeEntry> inspect <scene.excalidraw>\n  2. Write a DiagramPatch JSON file using inspected semantic ids.\n  3. Run: node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]\n  4. Run: node <runtimeEntry> review <output.excalidraw> [spec.json]\n  5. Visually inspect the reported preview PNG.\n\nPrimary commands:\n  build <spec.json>                         Build a new diagram.\n  review <scene.excalidraw> [spec.json]     Run deterministic gates and create a verified PNG for visual review.\n  preview <scene.excalidraw> [-o file.png]  Create only a portable PNG preview.\n  inspect <scene.excalidraw>                Inspect semantic structure before editing.\n  patch <scene.excalidraw> <patch.json>     Apply a semantic edit.\n  validate <scene.excalidraw>               Check basic scene validity.\n  editability-report <scene.excalidraw>     Check native editability.\n  quality-report <scene.excalidraw> [spec]  Check structural and family quality.\n  capabilities                              Print supported families/features.\n  schema                                    Print the DiagramSpec schema.\n  examples                                  Print compact agent recipes.\n  explain [overview|visual|frames|layout]   Explain an agent-facing concept.\n  init [--upgrade]                          Create or upgrade managed project prompts.\n  doctor [--global]                         Check installation.\n  install --global [--force]                Install managed runtime and register MCP globally.\n  uninstall --global [--force]              Remove managed runtime; VS Code MCP profile cleanup may be manual.\n  evaluate [--family <family>]              Run evaluation suite.\n  list-shapes                               Print shape catalog index.\n\nLLM rules:\n  - Prefer build/review for new diagrams and inspect/patch/review for edits.\n  - A passing metric report is not aesthetic approval: inspect the PNG when vision is available.\n  - Never use render to create PNG; render writes Excalidraw JSON only and is a low-level developer step.\n  - Do not probe multiple --help commands as a discovery loop.\n\nUse: excalidraw-skill help <command>. Developer helpers are listed by: excalidraw-skill help debug.`;
}

function commandHelp(name) {
  const help = {
    build: 'Usage: excalidraw-skill build <spec.json>\n\nBuild a new diagram from a DiagramSpec file.',
    review: 'Usage: excalidraw-skill review <scene.excalidraw> [spec.json]\n\nRun validate/editability/quality gates, create a PNG with signature verification, and emit review metadata requiring image-based visual review.',
    preview: 'Usage: excalidraw-skill preview <scene.excalidraw> [-o preview.png]\n\nCreate a valid portable PNG from the final scene for visual review. This preview is not pixel-identical to Excalidraw\'s native renderer.',
    inspect: 'Usage: excalidraw-skill inspect <scene.excalidraw>\n\nInspect semantic structure before edits.',
    patch: 'Usage: excalidraw-skill patch <scene.excalidraw> <patch.json> [-o output.excalidraw]\n\nPatch is only for editing an existing .excalidraw scene. Apply the smallest semantic edit and preserve unrelated manual layout.',
    init: 'Usage: excalidraw-skill init [--upgrade]\n\nCreate missing project prompts. --upgrade refreshes managed or recognized legacy generated prompts while preserving unmanaged files.',
    render: 'Usage: excalidraw-skill render <spec.json> [-o output.excalidraw]\n\nLow-level developer scene renderer. It writes Excalidraw JSON only and refuses PNG output paths. For a visual image, build first and use preview or review.',
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
    debug: 'Developer helpers: render, style-by-kind, layout-service-flow, layout-system-architecture, layout-module-architecture, check-refs, label-edges. Normal agents should prefer build/review or inspect/patch/review.'
  };
  return `${help[name] ?? `Unknown command: ${name}\n\n${generalHelp()}`}\n\nLLM rule: follow the happy paths instead of composing developer primitives.`;
}

if (command === 'help' || command === '--help' || command === '-h') printAndExit(command === 'help' && args[0] ? commandHelp(args[0]) : generalHelp());
if (hasHelpFlag()) printAndExit(commandHelp(command));
if (ARG_REQUIRED_COMMANDS.has(command) && args.length === 0) printAndExit(commandHelp(command), 1, console.error);

if (command === 'doctor') {
  if (hasFlag('--global')) {
    const report = doctorGlobalSkill();
    const vscode = doctorVscodeUserMcp({ targetDir: report.targetDir });
    console.log(JSON.stringify({ ...report, ...vscode }, null, 2));
    process.exit(report.ok ? 0 : 1);
  }
  console.log('excalidraw-skill doctor: ok');
  console.log(`node: ${process.version}`);
  console.log(`workspace: ${invocationCwd}`);
} else if (command === 'install') {
  requireGlobal();
  const installed = installGlobalSkill({ rootDir, force: hasFlag('--force') });
  const vscodeMcp = registerVscodeUserMcp({ targetDir: installed.targetDir, mcpServer: installed.mcpServer });
  console.log(JSON.stringify({ ...installed, vscodeMcp }, null, 2));
} else if (command === 'uninstall') {
  requireGlobal();
  const report = doctorGlobalSkill({ checkCli: false });
  const vscode = removeVscodeMcpMarker(report.targetDir);
  const removed = uninstallGlobalSkill({ force: hasFlag('--force') });
  console.log(JSON.stringify({ ...removed, ...vscode }, null, 2));
} else if (command === 'list-shapes') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/catalog/shapes.index.json'), 'utf8'));
} else if (command === 'examples') {
  console.log(fs.readFileSync(fromRoot('skills/excalidraw-skill/agent-recipes.json'), 'utf8'));
} else if (runners[command]) {
  run(runners[command]);
} else {
  printAndExit(commandHelp(command), 1, console.error);
}
