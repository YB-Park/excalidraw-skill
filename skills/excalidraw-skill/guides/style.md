# Style Guide

Use this guide when the user asks for polish, consistency, professional look, or presentation quality.

## Principle

The model chooses intent. The style preset chooses exact visual details.

Do not let the model freely invent colors, line widths, spacing, or font choices.

## Default preset

Use `team-architecture` unless the user asks for another style.

## Visual rules

- Use consistent node sizes within one frame.
- Keep labels short.
- Prefer frames for zones, systems, or phases.
- Use subtle backgrounds.
- Use color for meaning, not decoration.
- Keep icons paired with readable labels.
- Avoid dense vendor-icon collages.
- Use edge labels sparingly.

## Preset responsibilities

Style presets define:

- font family
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

The renderer applies exact Excalidraw values.
