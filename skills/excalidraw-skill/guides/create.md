# Create Guide

Use this guide for new diagrams when the user did not provide an existing `.excalidraw` file to edit.

New diagram work must follow the `build` workflow. Do not call `patch` for a new diagram. Do not call low-level `render` directly unless debugging the scene renderer; `render` writes Excalidraw JSON only and never creates PNG images.

## Required workflow

1. Restate the diagram goal in one sentence.
2. Choose exactly one diagram family from the question the diagram must answer.
3. If unsure about supported families, profiles, frames, or edge visual intent, run `capabilities`, `schema`, `examples`, or `explain` rather than reading runtime implementation files.
4. Write a `DiagramSpec` JSON file in the workspace for a currently renderable graph-like family.
5. Set `outputPath` to the desired `.excalidraw` path.
6. Add a compact Visual Plan when hierarchy, lanes, a primary flow, boundaries, or semantic edge emphasis matter.
7. Build:

```text
node <runtimeEntry> build <spec.json>
```

8. Inspect structural/editability evidence:

```text
node <runtimeEntry> inspect <output.excalidraw>
node <runtimeEntry> editability-report <output.excalidraw>
node <runtimeEntry> quality-report <output.excalidraw> <spec.json>
```

9. Read `visual-review.md`, create a portable PNG, and inspect the image when the host supports vision:

```text
node <runtimeEntry> preview <output.excalidraw> -o <output.preview.png>
```

Inspect the image before reading suggested patches. Check reading path, routing, labels, composition, whitespace, and semantic boundaries. A passing `QualityReport` is not aesthetic approval.

If a blocker or major visual defect exists, revise the `DiagramSpec` or Visual Plan and rebuild. Do not patch a brand-new diagram just to polish it. Prefer at most two visual refinement passes; persistent defects should be reported and captured as dogfood regressions.

If the host cannot inspect images, still create the preview and report its path, but explicitly state that visual approval was not performed.

## Diagram family selection

Choose from the user's question, not from the visible shapes.

- `system-architecture`: whole environment/layers/location. Currently runnable: `layered-system`; deployment/context views are contract-only.
- `module-architecture`: internal composition of one module. Currently runnable: `component-view`; internal-block/port-interface are contract-only.
- `flow`, `service-flow`, `event-flow`, `data-flow`: movement of requests/events/control/data. Runnable profiles include `layered-flow`, `swimlane-flow`, and `hub-and-spoke`.
- `sequence`: ordered interaction over time. Rendering is not implemented; only draft `SequenceSpec` when explicitly useful.

Do not overload one scene with multiple diagram-family questions. Create multiple diagrams when needed.

## DiagramSpec requirements

- Use `version: "2.0"` when visual hierarchy, primary flow, lanes, support concerns, or semantic edge styling matter.
- `stylePreset` is optional. Omit it unless needed; the runtime defaults to `professional-software`.
- If explicit, use `professional-software`; do not invent names such as `default-software`.
- Use `shapeRef`, semantic ids, relation kinds, layout hints, and semantic `edge.visual` when needed.
- Do not add raw coordinates or hand-author raw Excalidraw elements/styles.
- Preserve the user's terminology.
- Prefer 5 to 9 primary nodes unless the user asks for more detail.

## Visual planning

Read `contracts/visual-plan.md` for primary paths, supporting concerns, lanes, hubs, aspect ratio, meaningful boundaries, or semantic edge emphasis.

Choose high-level intent only: layout profile, direction, aspect ratio, primary flow, lanes, rank/importance, logical groups, explicit semantic boundaries, semantic edge visuals, small keep-near/keep-apart sets, and occasional edge-direction/label-side hints.

## Edge visual intent

Use `edge.visual` only when styling is semantically meaningful. `kind` remains the relation meaning/fallback style. Allowed visual fields:

- role: `default`, `data-plane`, `control-plane`, `event-stream`, `error-path`, `dependency`, `muted`
- emphasis: `normal`, `strong`, `critical`, `muted`
- stroke: `solid`, `dashed`, `dotted`

## Frames and boundaries

Prefer whitespace/alignment over boxes. Use visible frames only for real trust, ownership, deployment, external/internal, or substantial subsystem boundaries. Prefer zero or one frame in a small diagram and at most two unless explicitly requested. Do not frame single services/databases/queues/topics/workers by default.

## Labels and naming

Preserve user-provided names. Do not append type suffixes merely because `shapeRef` already carries that meaning. Keep labels concise without truncating; renderer-owned wrapping may use up to two lines.

## Output contract

Produce the spec first, then run `build`; exact placement, wrapping, routing, ports, frames, and Excalidraw details belong to the renderer. Return the `.excalidraw` path, preview PNG path, structural/editability summary, and visual-review result. Do not return raw Excalidraw JSON.
