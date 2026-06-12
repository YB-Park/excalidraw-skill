# DiagramSpec

`DiagramSpec` is the compact contract for creating a new diagram.

The agent writes this contract. The local CLI renders it into an Excalidraw scene.

## Required fields

- `version`
- `diagramType`
- `title`
- `stylePreset`
- `nodes`
- `edges`
- `outputPath`

## Node fields

- `semanticId`
- `label`
- `kind`
- `shapeRef`
- `group`
- `importance`

## Edge fields

- `semanticId`
- `from`
- `to`
- `label`
- `kind`

## Rules

- Use semantic ids, not raw Excalidraw element ids.
- Use shape refs from the catalog.
- Use a style preset instead of arbitrary visual values.
- Keep optional layout hints high level.
