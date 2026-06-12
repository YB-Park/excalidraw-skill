# Repository Structure

```txt
excalidraw-skill/
  README.md
  docs/
    AGENT_SETUP.md
    ARCHITECTURE.md
    DECISIONS.md
    STRUCTURE.md

  skills/
    excalidraw-skill/
      SKILL.md
      guides/
        create.md
        edit.md
        style.md
      diagram-types/
        service-flow.md
        event-flow.md
        c4-container-lite.md
      contracts/
        diagram-spec.md
        scene-summary.md
        diagram-patch.md
      catalog/
        shapes.index.json

  .opencode/
    commands/
      excalidraw.md

  .github/
    prompts/
      excalidraw.prompt.md

  assets/
    styles/
      team-architecture.md
    libraries/
      .gitkeep

  bin/
    excalidraw-skill.mjs
```

## Design

The repository has one canonical router skill: `skills/excalidraw-skill/SKILL.md`.

Platform-specific entrypoints should call that router instead of duplicating the full rules.

Detailed rendering behavior belongs in the CLI and style presets, not in a giant prompt.
