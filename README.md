# excalidraw-skill

LLM-assisted Excalidraw diagramming kit for internal developer workflows.

## Start here

- Agent setup: [`docs/AGENT_SETUP.md`](docs/AGENT_SETUP.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Structure: [`docs/STRUCTURE.md`](docs/STRUCTURE.md)
- Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Router skill

The canonical skill is:

- [`skills/excalidraw-skill/SKILL.md`](skills/excalidraw-skill/SKILL.md)

Platform entrypoints should call the router skill instead of duplicating all rules.

## Current scope

- opencode command entrypoint
- VS Code / Copilot prompt entrypoint
- task guides for create, edit, and style
- diagram type guides
- compact contracts
- shape catalog index
- style token preset
- future local CLI
