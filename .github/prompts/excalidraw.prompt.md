# Excalidraw Diagram Prompt

Use this prompt when the user asks for an Excalidraw software diagram from VS Code or Copilot Chat.

Use the repository skill at `skills/excalidraw-skill/SKILL.md` as the router. If a globally installed skill is available, read its router and use its marker-provided `runtimeEntry`.

## Request

Use the user's message as the diagram request.

## Required agent behavior

- Read only the task guide needed for the current request.
- Resolve whether this is a new diagram or an edit before running commands.
- If the user did not provide an existing `.excalidraw` file, treat the request as a new diagram.
- New diagram: follow `guides/create.md`, write a `DiagramSpec`, and run `node <runtimeEntry> build <spec.json>`.
- Existing edit: follow `guides/edit.md`, inspect first, then write and apply a `DiagramPatch`.
- After build or patch, verify editability/quality, then run `node <runtimeEntry> preview <scene.excalidraw> -o <scene.preview.png>`.
- When image vision is available, inspect the PNG using `guides/visual-review.md`; do not judge aesthetics from metrics alone.
- Inspect the image before reading suggested patches. Fix blocker/major visual defects with at most two bounded refinement passes.
- For a new diagram, refine the spec and rebuild; do not patch a brand-new diagram just for polish.
- For an existing diagram, use the smallest semantic patch and preserve unrelated manual layout.
- Do not use low-level `render` for PNG output. `render` writes Excalidraw JSON only.
- Do not probe multiple `--help` commands as a discovery loop. Follow the router recipes.
- After generation/edit, report the `.excalidraw` path, preview PNG path, quality result, and whether visual approval was actually performed.
