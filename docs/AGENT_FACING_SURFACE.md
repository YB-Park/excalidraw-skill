# Agent-Facing Surface

Normal diagram generation should use the skill commands and contracts, not low-level helpers.

## Discovery

```text
excalidraw-skill capabilities
excalidraw-skill schema
excalidraw-skill examples
excalidraw-skill explain overview
excalidraw-skill explain visual
excalidraw-skill explain frames
excalidraw-skill explain layout
```

## Generation

```text
excalidraw-skill build <spec.json>
excalidraw-skill inspect <scene.excalidraw>
excalidraw-skill quality-report <scene.excalidraw> <spec.json>
```

Use patch only after inspecting an existing scene:

```text
excalidraw-skill patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
```

## Maintenance notes

- Keep `capabilities.json`, schema, create guide, and examples synchronized.
- Keep evaluation coverage balanced across vertical and horizontal diagrams.
- Keep quality-report aligned with intent-preservation behavior.
- Add new capability entries whenever a renderer supports a new contract field.
