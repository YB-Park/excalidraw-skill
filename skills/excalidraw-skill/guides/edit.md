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
4. Apply the patch with the local runtime:

```text
node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
```

5. Validate the result:

```text
node <runtimeEntry> validate <output.excalidraw>
```

6. Review structural and family quality when a spec is available, or structural quality alone when it is not:

```text
node <runtimeEntry> quality-report <output.excalidraw> [spec.json]
```

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

## Patch command guardrails

`patch` requires both an existing scene path and a patch file. A bare `patch` command is never a valid diagram generation step.

Use this:

```text
node <runtimeEntry> patch existing.excalidraw change.patch.json -o updated.excalidraw
```

Do not use this:

```text
node <runtimeEntry> patch
```

## When in doubt

Make the smallest local change that satisfies the user request.
