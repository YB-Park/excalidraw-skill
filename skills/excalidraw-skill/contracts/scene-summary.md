# SceneSummary

`SceneSummary` is the compact read model for an existing Excalidraw scene.

The CLI creates this summary from a scene file. The agent uses it for edits and reviews.

## Purpose

Avoid sending the full raw Excalidraw JSON to the model for normal edits.

## Fields

- `sceneTitle`
- `diagramType`
- `stylePreset`
- `nodes`
- `edges`
- `frames`
- `warnings`

## Node summary

Each node should include:

- `semanticId`
- `label`
- `shapeRef`
- `frameId`
- `positionHint`
- `manualLayout`

## Edge summary

Each edge should include:

- `semanticId`
- `from`
- `to`
- `label`
- `kind`

## Rules

- Summaries should be stable and compact.
- Prefer semantic ids over element ids.
- Include enough layout hints for small patches.
- Do not include full style objects unless needed.
