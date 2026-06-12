# Create Guide

Use this guide for new diagrams.

## Steps

1. Restate the diagram goal in one sentence.
2. Choose one diagram type.
3. Collect only the minimum workspace context needed.
4. Select a style preset.
5. Select shape refs from the catalog index.
6. Write a `DiagramSpec`.
7. Use the local CLI to render the scene.
8. Validate the output.

## Diagram type selection

- Service calls or dependencies: `service-flow`
- Async event flow: `event-flow`
- System overview: `c4-container-lite`

## Keep it small

Prefer 5 to 9 primary nodes. Use frames when there are multiple areas or trust zones.

## Visual control

Do not invent colors or raw coordinates. Use `stylePreset`, `layoutHints`, and `shapeRef`.

## Output

For new work, produce a `DiagramSpec` first. The renderer owns Excalidraw element details.
