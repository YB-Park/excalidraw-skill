# Agent Setup Runbook

This file is for an LLM agent setting up this repository for a human user.

The human should be able to say:

```txt
Read docs/AGENT_SETUP.md and set this up globally.
```

Do the setup. Do not explain every internal detail unless something fails.

## Goal

Prepare both the global Copilot skill and the CLI so Excalidraw diagramming can be used from any workspace on this machine.

Project-local setup remains available when the user explicitly wants only the current repository configured.

## Rules

- Use the explicit global installer for `~/.copilot/skills`; do not copy files manually.
- Do not overwrite an unmanaged global skill directory unless the user explicitly permits `--force`.
- Keep project-local initialization separate from global installation.
- Stop and report the smallest blocker if a required command is missing.
- Do not overwrite user files unless the command is designed to be safe.

## Required checks

Run these first:

```txt
node --version
npm --version
git --version
```

Expected minimums:

- Node.js 20 or newer
- npm 10 or newer
- Git available

## Global setup

From this repository, run:

```txt
npm install
npm test
npm install -g .
excalidraw-skill install --global
excalidraw-skill doctor --global
```

Then confirm the global skill exists:

```txt
~/.copilot/skills/excalidraw-skill/SKILL.md
```

The installed directory must also contain:

```txt
guides/
contracts/
diagram-types/
catalog/
docs/
.excalidraw-skill-install.json
```

`doctor --global` must report both `skillOk: true` and `cliOk: true`.

After installation, start a new Copilot chat or reload VS Code so Copilot scans the skill directory again.

## Project-local setup

Use this only when the user wants entrypoints inside the current project:

```txt
npm install
npm run doctor
npm run init
```

Then check these files exist in the current workspace:

```txt
.opencode/commands/excalidraw.md
.github/prompts/excalidraw.prompt.md
```

`npm run init` does not install anything into `~/.copilot/skills`.

## Smoke test

Run from this repository:

```txt
npm run smoke
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.grouped.excalidraw
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.grouped.excalidraw
```

If this succeeds, report the generated file path:

```txt
examples/service-flow/payment-flow.grouped.excalidraw
```

## Cross-workspace CLI check

From another writable workspace, run:

```txt
excalidraw-skill init
```

The `.opencode` and `.github/prompts` entrypoints must be created in that workspace, not in the globally installed npm package directory.

## VS Code Excalidraw extension

If VS Code is available, check whether the Excalidraw extension is installed:

```txt
code --list-extensions
```

If `pomdtr.excalidraw-editor` is missing, install it:

```txt
code --install-extension pomdtr.excalidraw-editor
```

If the `code` command is not available, tell the user to install the VS Code extension manually:

```txt
Extension name: Excalidraw
Extension id: pomdtr.excalidraw-editor
```

## First user-facing test

After setup, open a fresh Copilot chat in any project and request:

```txt
시스템 초기화 과정을 시퀀스 다이어그램으로 만들어줘
```

Copilot should discover the global `excalidraw-skill` bundle and use the `excalidraw-skill` CLI from `PATH`.

## Update

After pulling a newer version:

```txt
npm install -g .
excalidraw-skill install --global
excalidraw-skill doctor --global
```

## What success looks like

- `npm test` passes.
- `excalidraw-skill` is available on `PATH`.
- `~/.copilot/skills/excalidraw-skill/SKILL.md` exists.
- the installed skill bundle is self-contained.
- `doctor --global` reports ok.
- project-local `init` modifies the invoking workspace.
- `smoke` generates a `.excalidraw` file.
- VS Code can open the generated `.excalidraw` file when the extension is installed.
