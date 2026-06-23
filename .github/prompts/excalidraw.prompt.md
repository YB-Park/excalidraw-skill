# Excalidraw Diagram Prompt

Use this prompt when the user asks for an Excalidraw software diagram from VS Code or Copilot Chat.

Use the repository skill at `skills/excalidraw-skill/SKILL.md` as the router. If a globally installed skill is available, read its router and use its marker-provided `runtimeEntry`.

## Request

Use the user's message as the diagram request.

## Required agent behavior

- Read only the task guide needed for the current request.
- Resolve whether this is a new diagram or an edit before running commands.
- If the user did not provide an existing `.excalidraw` file, treat the request as a new diagram.
- For a new diagram, follow `guides/create.md`, write a `DiagramSpec`, and run:

```text
node <runtimeEntry> build <spec.json>
```

- For an existing diagram edit, follow `guides/edit.md`, run `inspect` first, then write and apply a `DiagramPatch`.
- For visual polish, inspect the existing scene first, then follow `guides/style.md`.
- Do not call `patch` for a new diagram.
- Do not call low-level `render` directly for normal generation.
- Do not probe `render --help`, `validate --help`, or `patch --help` as a discovery loop. Follow the router recipes.
- Use catalog shape refs and style presets.
- After generation, report the `.excalidraw` path and the quality result.
