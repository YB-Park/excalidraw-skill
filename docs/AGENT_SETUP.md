# Agent Setup Runbook

This file is for an LLM agent setting up this repository for a human user.

The human should be able to say:

```txt
Read docs/AGENT_SETUP.md and set this up globally.
```

Do the setup. Do not explain every internal detail unless something fails.

## Goal

Prepare a global Copilot skill and a user-owned runtime so Excalidraw diagramming can be used from any workspace on this machine.

Project-local setup remains available when the user explicitly wants only the current repository configured.

## Rules

- Use the explicit global installer; do not copy files manually.
- Do not require `npm install -g`, a system symlink, or administrator privileges for the default installation.
- Do not use `sudo` as the default response to npm `EACCES` errors.
- Do not overwrite unmanaged skill or runtime directories unless the user explicitly permits `--force`.
- Keep project-local initialization separate from global installation.
- Stop and report the smallest blocker if a required command is missing.

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
npm run skill:install:global
npm run skill:doctor:global
```

Confirm both managed directories exist:

```txt
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

The skill directory must contain:

```txt
SKILL.md
guides/
contracts/
diagram-types/
catalog/
docs/
.excalidraw-skill-install.json
```

The runtime directory must contain:

```txt
bin/excalidraw-skill.mjs
src/
assets/
package.json
.excalidraw-skill-runtime.json
```

The skill marker must contain an absolute `runtimeEntry` path. `doctor --global` must report `skillOk: true`, `runtimeOk: true`, and `ok: true`.

`cliOk` may be false. The optional PATH command is not required because the skill calls its managed runtime directly.

After installation, start a new Copilot chat or reload VS Code so Copilot scans the skill directory again.

## Optional PATH command

Only install the convenience command when the user explicitly wants to run `excalidraw-skill` directly in a terminal.

If `npm install -g .` reports `EACCES`, prefer a Node version manager or a user-owned npm prefix. Do not automatically retry with `sudo`.

On macOS or Linux, one supported user-prefix approach is:

```txt
npm config set prefix ~/.local
```

Ensure `~/.local/bin` is on `PATH`, then run:

```txt
npm install -g .
```

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

`npm run init` does not install anything into `~/.copilot`.

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

## Managed runtime check

Read the global skill marker and use its `runtimeEntry` value to run a command from another writable workspace:

```txt
node <runtimeEntry> init
```

The `.opencode` and `.github/prompts` entrypoints must be created in that workspace, not in the managed runtime directory.

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

After setup, open a fresh Copilot chat in any unrelated project and request:

```txt
결제 승인 흐름을 Excalidraw 다이어그램으로 만들어줘. 사용 가능한 skill을 먼저 확인해줘.
```

Copilot should discover the global `excalidraw-skill` bundle, read `runtimeEntry`, and use the managed runtime.

## Update

After pulling a newer version:

```txt
git pull
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

## What success looks like

- `npm test` passes.
- `~/.copilot/skills/excalidraw-skill/SKILL.md` exists.
- `~/.copilot/tools/excalidraw-skill/bin/excalidraw-skill.mjs` exists.
- the installed skill marker points to the runtime entry.
- `doctor --global` reports `skillOk`, `runtimeOk`, and `ok` as true.
- project-local `init` modifies the invoking workspace.
- `smoke` generates a `.excalidraw` file.
- VS Code can open the generated `.excalidraw` file when the extension is installed.
