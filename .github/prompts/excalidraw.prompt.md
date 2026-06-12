# Excalidraw Diagram Prompt

Use this prompt when the user asks for an Excalidraw software diagram from VS Code or Copilot Chat.

Use the repository skill at `skills/excalidraw-skill/SKILL.md` as the router.

## Request

Use the user's message as the diagram request.

## Rules

- Read only the task guide needed for the current request.
- For a new diagram, follow `guides/create.md`.
- For an existing diagram edit, follow `guides/edit.md`.
- For visual polish, follow `guides/style.md`.
- Prefer local CLI commands when available.
- Use catalog shape refs and style presets.
