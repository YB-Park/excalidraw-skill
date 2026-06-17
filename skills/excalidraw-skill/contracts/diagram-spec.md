# DiagramSpec

`DiagramSpec` is the compact contract for creating a new diagram.

The agent writes this contract. The local CLI renders it into an Excalidraw scene.

## Versions

- `1.0`: semantic nodes and edges with minimal high-level hints
- `2.0`: adds a compact Visual Plan for layout intent without raw coordinates

Use `2.0` when layout quality matters or when a diagram has a primary flow plus supporting concerns.

Machine-readable v2 schema: `diagram-spec-v2.schema.json`.
Visual planning rules: `visual-plan.md`.

## Required fields

- `version`
- `diagramType`
- `title`
- `stylePreset`
- `nodes`
- `edges`
- `outputPath`

## Optional top-level layout

DiagramSpec v2 may include:

- `layout.profile`
- `layout.direction`
- `layout.aspectRatio`
- `layout.primaryFlow`
- `layout.lanes`

Initial profiles:

- `layered-flow`
- `hub-and-spoke`
- `swimlane-flow`

## Node fields

Core fields:

- `semanticId`
- `label`
- `kind`
- `shapeRef`
- `group`
- `fontRole`

Optional v2 `layoutHints`:

- `lane`
- `rank`
- `importance`
- `keepNear`
- `keepApart`

## Edge fields

Core fields:

- `semanticId`
- `from`
- `to`
- `label`
- `kind`
- `fontRole`

Optional v2 `routeHints`:

- `direction`
- `priority`
- `labelSide`

## Rules

- Use semantic ids, not raw Excalidraw element ids.
- Use shape refs from the catalog.
- Use a style preset instead of arbitrary visual values.
- Do not put raw coordinates in DiagramSpec.
- Keep the primary flow short and ordered.
- Use lanes to separate supporting concerns from the primary flow.
- Use layout and route hints only when they express real visual intent.
- Let the renderer own exact positions, bends, label offsets, and Excalidraw details.
