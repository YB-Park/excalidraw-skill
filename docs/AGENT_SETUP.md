# Agent Setup Guide

This note is for an LLM agent working in a cloned copy of this repository.

The human user should be able to say something like:

```txt
Read the guide and set this up.
```

Keep the setup simple. Do not explain every detail unless something fails.

## Goal

Prepare the local workspace so the Excalidraw diagramming skill can be used from VS Code and opencode.

## Check first

- Node.js 20 or newer
- npm 10 or newer
- Git

If the environment is not ready, report the smallest blocker.

## Useful files

- `README.md`
- `docs/DECISIONS.md`
- `docs/STRUCTURE.md`
- `skills/excalidraw-skill/SKILL.md`
- `.github/prompts/excalidraw.prompt.md`
- `.opencode/commands/excalidraw.md`
- `package.json`

## Local setup intent

The installer will eventually copy or link the shared skill into the right VS Code and opencode locations.

For now, treat this repository as the source of truth and keep all edits local to this repository unless the user asks for a global install.
