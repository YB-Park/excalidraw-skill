# Edit Guide

Use this guide only when the user wants to change an existing Excalidraw scene and provides or clearly refers to an existing `.excalidraw` file.

If no existing `.excalidraw` path is present, use `guides/create.md` instead. Do not run `patch` for a new diagram.

## Required flow

1. Inspect the existing scene first:

```text
node <runtimeEntry> inspect <scene.excalidraw>
```

2. Work from `SceneSummary`, not the full raw scene.
3. Produce a `DiagramPatch` using semantic ids from the inspected summary.
4. Apply the patch:

```text
node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
```

5. Validate native editability and structural/family quality:

```text
node <runtimeEntry> editability-report <output.excalidraw>
node <runtimeEntry> validate <output.excalidraw>
node <runtimeEntry> quality-report <output.excalidraw> [spec.json]
```

6. Read `visual-review.md`, create a PNG, and inspect it when the host supports image vision:

```text
node <runtimeEntry> preview <output.excalidraw> -o <output.preview.png>
```

Inspect the image before reading suggested patches. Verify that the requested change is visually local, the reading path still works, affected routes/labels remain clear, and unrelated manual layout did not move.

If a blocker/major defect remains, make the smallest additional semantic patch. Prefer at most two visual refinement passes. If the host cannot inspect images, still create the preview and explicitly say that visual approval was not performed.

Patch itself runs native editability and structural safety gates. A passing gate is not aesthetic approval.

## Preserve human work

Default to `preserveManualLayout: true`.

Do not move manually adjusted unrelated objects unless the user explicitly asks for cleanup or relayout. Do not overwrite labels unless requested. Affected/connected edges may be rerouted when required to preserve endpoint integrity or other hard geometry constraints.

## Patch operations

Executable semantic operations:

- `addNode`
- `addEdge`
- `updateLabel`
- `moveNear`
- `insertNodeBetween`
- `groupIntoFrame`
- `applyStylePreset`
- `removeObject`

There is no separate `updateEdge`; rewire by removing the semantic edge and adding the replacement. Unknown operations must fail rather than silently doing nothing. Avoid raw Excalidraw element diffs.

## Command guardrails

`patch` requires both an existing scene path and a patch file:

```text
node <runtimeEntry> patch existing.excalidraw change.patch.json -o updated.excalidraw
```

Never use low-level `render` to create a PNG. `render` writes Excalidraw JSON only. Use `preview` after the patch for visual review.

## When in doubt

Make the smallest local change that satisfies the request. Keep the original scene/spec during dogfood so a visual defect can be reproduced instead of hidden by full regeneration. Turn recurring defects into deterministic repair logic or regression fixtures.
