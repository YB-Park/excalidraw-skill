---
description: Create or update an Excalidraw software diagram
---

Use the `excalidraw-skill` router skill.

User request:

$ARGUMENTS

Rules:

- Read only the guide needed for this task.
- Decide whether this is a new diagram or an existing diagram edit before running commands.
- If no existing `.excalidraw` file is provided, this is a new diagram: write a `DiagramSpec` and run `node <runtimeEntry> build <spec.json>`.
- For existing diagrams, inspect first and use `DiagramPatch`.
- Do not run `patch` for a new diagram.
- Do not use low-level `render` directly for normal generation.
- Do not probe `render --help`, `validate --help`, or `patch --help` as a discovery loop.
- After generation or edit, report the `.excalidraw` output path and quality summary.
