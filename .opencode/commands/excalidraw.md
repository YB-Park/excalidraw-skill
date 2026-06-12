---
description: Create or update an Excalidraw software diagram
---

Use the `excalidraw-skill` router skill.

User request:

$ARGUMENTS

Rules:

- Read only the guide needed for this task.
- For new diagrams, use `DiagramSpec`.
- For existing diagrams, inspect first and use `DiagramPatch`.
- Prefer the local CLI when available.
