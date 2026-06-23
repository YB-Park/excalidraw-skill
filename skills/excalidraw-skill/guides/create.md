# Create Guide

Use this guide for new diagrams when the user did not provide an existing `.excalidraw` file to edit.

New diagram work must follow the `build` workflow. Do not call `patch` for a new diagram. Do not call low-level `render` directly unless debugging the renderer pipeline.

## Required workflow

1. Restate the diagram goal in one sentence.
2. Choose exactly one diagram family from the question the diagram must answer.
3. If the chosen family is graph-like and currently renderable, write a `DiagramSpec` JSON file in the workspace.
4. Set `outputPath` in the spec to the desired `.excalidraw` output path.
5. Add a compact Visual Plan when layout quality depends on hierarchy, lanes, or a primary flow.
6. Run the build command:

```text
node <runtimeEntry> build <spec.json>
```

7. Inspect and review the generated output:

```text
node <runtimeEntry> inspect <output.excalidraw>
node <runtimeEntry> quality-report <output.excalidraw> <spec.json>
```

8. Report the output path and the quality summary. Mention any important `suggestedPatches` or visual-review caveats.

`validate` checks basic file validity only. Use `quality-report` for structural and family-specific quality evidence.

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

- Use `version: "2.0"` when visual hierarchy, primary flow, lanes, or support concerns matter.
- Use `stylePreset`, `shapeRef`, semantic ids, relation kinds, and layout hints.
- Do not add raw coordinates.
- Do not hand-author raw Excalidraw elements.
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

## Frames and boundaries

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

## Output contract

For new work, produce the spec file first, then run `build`. The renderer owns exact placement, text wrapping, node size classes, routing, frame suppression, label offsets, ports, frames, and Excalidraw details.

Return the generated `.excalidraw` path. Do not return raw Excalidraw JSON as the final answer.
