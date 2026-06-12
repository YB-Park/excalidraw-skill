# Agent Setup Runbook

This file is for an LLM agent setting up this repository for a human user.

The human should be able to say:

```txt
Read docs/AGENT_SETUP.md and set this up.
```

Do the setup. Do not explain every internal detail unless something fails.

## Goal

Prepare the local workspace so the Excalidraw diagramming skill can be used from opencode, VS Code, and the local CLI.

## Rules

- Keep edits local to this repository unless the user explicitly asks for a global install.
- Prefer project-local setup for the first release.
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

## Package setup

Run:

```txt
npm install
npm run doctor
npm run init
```

Then check these files exist:

```txt
skills/excalidraw-skill/SKILL.md
.opencode/commands/excalidraw.md
.github/prompts/excalidraw.prompt.md
bin/excalidraw-skill.mjs
```

## Smoke test

Run:

```txt
npm run smoke
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.grouped.excalidraw
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.grouped.excalidraw
```

If this succeeds, report the generated file path:

```txt
examples/service-flow/payment-flow.grouped.excalidraw
```

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

After setup, suggest this command:

```txt
/excalidraw 결제 승인 흐름 다이어그램 만들어줘
```

For VS Code/Copilot Chat, suggest opening `.github/prompts/excalidraw.prompt.md` or asking the model to read `skills/excalidraw-skill/SKILL.md`.

## What success looks like

- `doctor` passes.
- `init` reports checked and created entrypoints.
- `smoke` generates a `.excalidraw` file.
- `inspect` prints a compact scene summary.
- `validate` returns ok.
- VS Code can open the generated `.excalidraw` file when the extension is installed.
