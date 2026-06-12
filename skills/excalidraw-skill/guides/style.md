# Style Guide

Use this guide when the user asks for polish, consistency, professional look, or presentation quality.

## Principle

The model chooses intent. The style preset chooses exact visual details.

Do not let the model freely invent colors, line widths, spacing, icons, or font choices.

## Default preset

Use `professional-software` unless the user explicitly asks for another style.

## Visual rules

- Use consistent node sizes within one frame.
- Keep labels short.
- Prefer frames for zones, systems, or phases.
- Use subtle backgrounds.
- Use color for meaning, not decoration.
- Keep component details paired with readable labels.
- Avoid dense vendor-icon collages.
- Use edge labels sparingly.

## Font rules

Use the font policy in `skills/excalidraw-skill/styles/fonts.md`.

LLMs must choose only a `fontRole`, not arbitrary font names:

- `default`: normal node labels and edge labels.
- `mono`: code-like labels such as API paths, event names, topic names, queue names, or short technical identifiers.
- `sketch`: only when the user explicitly asks for a whiteboard or workshop feel.

The renderer maps these roles to Excalidraw fontFamily values. Do not introduce additional fonts in v0.2.

## Preset responsibilities

Style presets define:

- font role mapping
- roughness
- stroke width
- palette
- frame padding
- grid spacing
- edge style mapping

## Agent responsibilities

The agent selects:

- diagram type
- style preset
- semantic emphasis
- shape family
- frame grouping
- optional fontRole for code-like text

The renderer applies exact Excalidraw values.
