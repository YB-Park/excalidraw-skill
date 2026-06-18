# Create Guide

Use this guide for new diagrams.

## Steps

1. Restate the diagram goal in one sentence.
2. Choose one diagram type.
3. Collect only the minimum workspace context needed.
4. Select a style preset.
5. Select shape refs from the catalog index.
6. Write a `DiagramSpec`.
7. Add a compact Visual Plan when layout quality depends on hierarchy, lanes, or a primary flow.
8. Use the local CLI to render the scene.
9. Validate the output.

## Diagram type selection

- Service calls or dependencies: `service-flow`
- Async event flow: `event-flow`
- System overview: `c4-container-lite`

## Keep it small

Prefer 5 to 9 primary nodes.

Treat lanes and node groups as layout hints first, not visible regions. Prefer whitespace, alignment, and supporting lanes over extra boxes.

Use a visible frame only when it communicates a real trust boundary, ownership boundary, deployment boundary, external/internal boundary, or a substantial subsystem containing several nodes.

Default frame rules:

- Prefer zero or one frame in a small diagram.
- Use at most two frames unless the user explicitly requests more.
- Do not frame a single node.
- Do not create a frame around an individual database, queue, topic, worker, service, or provider.
- Do not create one frame per concern, lane, or node type.
- Do not wrap the entire diagram in a frame unless that boundary is meaningful.
- When a visible boundary is required, declare it with `groups[].visualBoundary: true`.

## Labels and naming

Preserve user-provided display names whenever possible.

Do not append type suffixes such as `Service`, `Database`, `DB`, `Queue`, `Topic`, or `Worker` merely because the selected `shapeRef` already carries that meaning. Add a suffix only when the user supplied it or when it is necessary to distinguish otherwise ambiguous names.

Keep labels concise, but never truncate them. The renderer may wrap labels to at most two lines and choose from compact, standard, or wide node sizes. Do not insert manual line breaks unless the exact break is semantically important.

## Visual planning

Read `contracts/visual-plan.md` when the diagram has:

- a clear primary reading path
- supporting concerns that should be separated by placement
- multiple visual lanes
- a central hub with many relationships
- a need to prefer balanced, wide, or tall composition
- a real boundary that may require one visible frame

Use DiagramSpec v2 for those cases.

Choose high-level intent only:

- layout profile
- direction
- aspect ratio
- primary flow
- lanes
- node rank and importance
- logical groups
- explicit visible boundaries only when semantically necessary
- small keep-near or keep-apart sets
- occasional edge direction and label-side hints

Do not add raw coordinates or manually author Excalidraw elements.

## Visual control

Do not invent colors or raw coordinates. Use `stylePreset`, `layout`, `layoutHints`, `routeHints`, `group`, `groups`, and `shapeRef`.

Prefer one obvious primary flow. Place data stores, risk checks, async topics, and background workers in supporting lanes when they are not part of the main reading path. A supporting lane should normally remain visually unboxed.

## Output

For new work, produce a `DiagramSpec` first. The renderer owns exact placement, text wrapping, node size classes, routing, frame suppression, label offsets, and Excalidraw element details.
