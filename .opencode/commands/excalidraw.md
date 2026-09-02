<!-- excalidraw-skill-generated:v1 -->
---
description: Create or update an Excalidraw software diagram
---

Use the `excalidraw-skill` router skill.

User request:

$ARGUMENTS

Rules:

- Read only the guide needed for this task.
- Decide whether this is a new diagram or an existing diagram edit before running commands.
- If no existing `.excalidraw` file is provided, write a `DiagramSpec` and run `node <runtimeEntry> build <spec.json>`.
- For existing diagrams, inspect first and use `DiagramPatch`.
- After build or patch, run `node <runtimeEntry> review <scene.excalidraw> [spec.json]`; this creates the PNG preview and deterministic review evidence in one happy path.
- If image vision is available, inspect the PNG reported by `review` using `guides/visual-review.md`; a passing quality report is not aesthetic approval.
- Keep visual refinement bounded to at most two passes. New diagrams should be refined through the spec; existing diagrams through the smallest semantic patch.
- Do not run `patch` for a new diagram.
- Never use low-level `render` to create PNG files; it writes Excalidraw JSON only and is developer-only.
- Do not probe multiple `--help` commands as a discovery loop.
- Report the `.excalidraw` path, preview path, quality summary, and whether visual approval was performed.
