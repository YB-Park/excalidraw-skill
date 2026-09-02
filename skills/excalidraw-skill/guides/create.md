# Create Guide

Use this guide for new diagrams when the user did not provide an existing `.excalidraw` file to edit.

New diagram work must follow the `build` workflow. Do not call `patch` for a new diagram. Do not call low-level `render` directly unless debugging the renderer pipeline.

## Required workflow

1. Restate the diagram goal in one sentence.
2. Choose exactly one diagram family from the question the diagram must answer.
3. If unsure about supported families, profiles, frames, or edge visual intent, run `capabilities`, `schema`, `examples`, or `explain` rather than reading runtime implementation files.
4. If the chosen family is graph-like and currently renderable, write a `DiagramSpec` JSON file in the workspace.
5. Set `outputPath` in the spec to the desired `.excalidraw` output path.
6. Add a compact Visual Plan when layout quality depends on hierarchy, lanes, a primary flow, explicit boundaries, or semantic edge emphasis.
7. Run the build command:

```text
node <runtimeEntry> build <spec.json>
```

8. Inspect and review the generated output:

```text
node <runtimeEntry> inspect <output.excalidraw>
node <runtimeEntry> quality-report <output.excalidraw> <spec.json>
```

9. Report the output path and the quality summary. Mention any important `suggestedPatches` or visual-review caveats.

`validate` checks basic file validity only. Use `quality-report` for structural, family-specific, and intent-preservation evidence.

## Diagram family selection

Choose from the user's question, not from the visible shapes.

- Use `system-architecture` when the question is where software, middleware, hardware, OS layers, hosts, or external systems sit in the whole environment.
  - Currently runnable profile: `layered-system`.
  - `deployment-view` and `context-view` are contract-only.
- Use `module-architecture` when the question is how one module is internally composed from blocks, responsibilities, interfaces, state, or adapters.
  - Currently runnable profile: `component-view`.
  - `internal-block` and `port-interface-view` are contract-only.
- Use `flow`, `service-flow`, `event-flow`, or `data-flow` when the question is how a request, event, control signal, or data item moves through the system.
  - Runnable profiles include `layered-flow`, `swimlane-flow`, and `hub-and-spoke`.
- Use `sequence` only when time-ordered interaction is the main question.
  - Sequence rendering is not implemented yet. Do not route it through the graph or flow renderer.
  - If the user still wants useful output now, produce a `SequenceSpec` draft and clearly state that rendered `.excalidraw` output is not available yet.

Do not overload one scene with system, module, flow, and sequence concerns. Create multiple diagrams if the user needs multiple questions answered.

## DiagramSpec requirements

For renderable graph-like diagrams:

- Use `version: "2.0"` when visual hierarchy, primary flow, lanes, support concerns, or semantic edge styling matter.
- `stylePreset` is optional. Omit it when the user did not ask for a different style; the runtime defaults to `professional-software`.
- If `stylePreset` is written explicitly, use `professional-software`. Do not invent names such as `default-software`.
- Use `shapeRef`, semantic ids, relation kinds, layout hints, and semantic `edge.visual` when needed.
- Do not add raw coordinates.
- Do not hand-author raw Excalidraw elements.
- Do not use raw edge colors, raw stroke widths, or arbitrary Excalidraw style values in the spec.
- Preserve the user's source terminology in labels.
- Prefer 5 to 9 primary nodes unless the user explicitly asks for more detail.

## Visual planning

Read `contracts/visual-plan.md` when the diagram has:

- a clear primary reading path
- supporting concerns that should be separated by placement
- multiple visual lanes
- a central hub with many relationships
- a need to prefer balanced, wide, or tall composition
- a real boundary that may require one visible frame
- semantic edge emphasis such as data-plane, event-stream, control-plane, or error-path edges

Choose high-level intent only:

- layout profile
- direction
- aspect ratio
- center lane axis when a swimlane center must remain stable
- primary flow
- lanes
- node rank and importance
- logical groups
- explicit visible boundaries only when semantically necessary
- semantic edge visual intent
- small keep-near or keep-apart sets
- occasional edge direction and label-side hints

## Edge visual intent

Use `edge.visual` when the visual styling is semantically meaningful. `kind` remains the relation meaning and fallback preset. `edge.visual` wins over kind-based styling in the final output.

Allowed fields:

- `visual.role`: `default`, `data-plane`, `control-plane`, `event-stream`, `error-path`, `dependency`, `muted`
- `visual.emphasis`: `normal`, `strong`, `critical`, `muted`
- `visual.stroke`: `solid`, `dashed`, `dotted`

Example:

```json
{
  "semanticId": "collector-pipeline",
  "from": "collector",
  "to": "pipeline",
  "kind": "transfers",
  "visual": { "role": "data-plane", "emphasis": "critical", "stroke": "solid" }
}
```

## Swimlane center anchoring

For `swimlane-flow`, use center axis hints only when the center lane must remain stable despite left/right or top/bottom support lanes.

- `direction: "top-to-bottom"` may use `layout.centerAxisX`.
- `direction: "left-to-right"` may use `layout.centerAxisY`.

Do not use these as raw coordinates for individual nodes. They anchor the center lane, not every object.

## Frames and boundaries

Treat lanes and node groups as layout hints first, not visible regions. Prefer whitespace, alignment, and supporting lanes over extra boxes.

Use a visible frame only when it communicates a real trust boundary, ownership boundary, deployment boundary, external/internal boundary, or a substantial subsystem containing several nodes.

Default frame rules:

- Prefer zero or one frame in a small diagram.
- Use at most two frames unless the user explicitly requests more.
- Do not frame a single node unless the user explicitly requested a singleton boundary and `framePolicy.allowSingletons: true` is set.
- Do not create a frame around an individual database, queue, topic, worker, service, or provider by default.
- Do not create one frame per concern, lane, or node type.
- Do not wrap the entire diagram in a frame unless that boundary is meaningful.
- When a visible boundary is required, declare it with `groups[].visualBoundary: true`.
- If a meaningful boundary intentionally contains every node in the scene, it must still be explicit: use `groups[].visualBoundary: true`, `groups[].forceFrame: true`, or `framePolicy.include`. Implicit full-scene groupings are suppressed by default.
- Adjacent explicit frames reserve spacing for frame rectangles and native frame titles at 100% export scale.

## Labels and naming

Preserve user-provided display names whenever possible.

Do not append type suffixes such as `Service`, `Database`, `DB`, `Queue`, `Topic`, or `Worker` merely because the selected `shapeRef` already carries that meaning. Add a suffix only when the user supplied it or when it is necessary to distinguish otherwise ambiguous names.

Keep labels concise, but never truncate them. The renderer may wrap labels to at most two lines and choose from compact, standard, or wide node sizes. Do not insert manual line breaks unless the exact break is semantically important.

## Output contract

For new work, produce the spec file first, then run `build`. The renderer owns exact placement, text wrapping, node size classes, routing, frame suppression, label offsets, ports, frames, and Excalidraw details.

Return the generated `.excalidraw` path. Do not return raw Excalidraw JSON as the final answer.
