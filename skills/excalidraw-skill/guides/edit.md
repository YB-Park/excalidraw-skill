# Edit Guide

Use this guide when the user wants to change an existing Excalidraw scene.

## Required flow

1. Inspect the existing scene first.
2. Work from `SceneSummary`, not the full raw scene.
3. Produce a `DiagramPatch`.
4. Apply the patch with the local CLI.
5. Validate the result.

## Preserve human work

Default to `preserveManualLayout: true`.

Do not move manually adjusted objects unless the user explicitly asks for cleanup or relayout.

Do not overwrite labels unless the patch says the label should change.

## Patch style

Prefer semantic operations:

- addNode
- addEdge
- insertNodeBetween
- updateLabel
- moveNear
- groupIntoFrame
- applyStylePreset

Avoid raw Excalidraw element diffs.

## When in doubt

Make the smallest local change that satisfies the user request.
