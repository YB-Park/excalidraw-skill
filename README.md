# excalidraw-skill

LLM-assisted Excalidraw diagramming kit for internal developer workflows.

This repository is intentionally designed so that a user can clone it and ask an LLM agent:

```txt
가이드 읽고 설치 진행해줘
```

The primary installation guide is **agent-facing**, not human-facing:

- Start here: [`docs/INSTALL_FOR_LLM.md`](docs/INSTALL_FOR_LLM.md)
- Repository structure: [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md)

## Current scope

This repo is the early scaffold for:

- global opencode `/excalidraw` command
- global opencode skill
- global VS Code / agent-compatible skill
- shared Excalidraw diagramming rules
- future local CLI for `DiagramSpec -> .excalidraw` and `.excalidraw -> inspect -> patch`

Implementation details will be refined incrementally.
