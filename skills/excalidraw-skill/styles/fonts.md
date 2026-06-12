# Font policy

Use a small, opinionated font set. Do not ask the LLM to invent font names.

## Font preset

Default preset: `professional`.

| Role | Excalidraw fontFamily | Use |
| --- | ---: | --- |
| `default` | `2` | Normal software diagram text. Professional, neutral, readable. |
| `mono` | `3` | Code-like labels: API paths, event names, topics, queue names. |
| `sketch` | `5` | Whiteboard or brainstorming mode only. Not the default. |

## Rules for LLMs

- Prefer `fontRole`, not raw font names.
- Use `default` for ordinary node and edge labels.
- Use `mono` only for code-like identifiers.
- Use `sketch` only when the user explicitly asks for a hand-drawn or workshop feel.
- Do not introduce additional fonts in v0.2.
- Do not require users to install external fonts for v0.2.

## Korean text

Korean labels are supported through the viewer/browser/OS fallback chain. v0.2 does not bundle custom font files. Keep Korean labels short, clean, and readable.

## Future

A later version may vendor a small open font bundle, but v0.2 should stay on Excalidraw built-in fontFamily IDs and system fallback.
