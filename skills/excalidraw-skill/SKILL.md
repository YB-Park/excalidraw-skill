---
name: excalidraw-skill
description: Generate, inspect, update, and polish software diagrams using editable Excalidraw scenes, compact contracts, team style presets, and an installed user runtime.
---

# Excalidraw Skill Router

This is the only top-level skill the agent should select for Excalidraw diagram work.

Resolve every relative path in this file from the directory containing this `SKILL.md`. The installed bundle is self-contained.

## Runtime

- Read `.excalidraw-skill-install.json` beside this file.
- Use its absolute `runtimeEntry` value with Node.js: `node <runtimeEntry> <command> ...`.
- If the optional `excalidraw-skill` command exists on `PATH`, it may be used instead.
- Run commands in the user's current workspace.
- Treat input and output paths as workspace-relative unless the user provides an absolute path.
- If `runtimeEntry` is missing or unreadable, report that the global runtime installation is incomplete instead of hand-writing raw Excalidraw JSON.
- Do not repeatedly call `--help` to discover normal usage. Follow the command recipes in this router.

Keep this file small. Read only the guide files needed for the current task.

## Task decision

Choose the workflow from the user's request before running commands.

- New diagram: the user asks to create, generate, draw, or make a diagram and does not provide an existing `.excalidraw` path.
  - Read `guides/create.md`.
  - Write a `DiagramSpec` or, for sequence-only requests, follow the sequence policy below.
  - Run `build` on the spec.
  - Do not run `inspect` first.
  - Do not run `patch`.
- Existing diagram update: the user provides or clearly refers to an existing `.excalidraw` file.
  - Read `guides/edit.md`.
  - Run `inspect` first.
  - Write a `DiagramPatch` from the `SceneSummary`.
  - Run `patch`.
- Visual polish of an existing diagram: read `guides/style.md` after inspecting the scene.
- Shape selection: read `catalog/shapes.index.json` only when choosing `shapeRef` values.

If the request is ambiguous, prefer the new-diagram workflow unless an existing `.excalidraw` path is present.

## Command recipes

### New graph-like diagram

Use this for `system-architecture`, `module-architecture`, `flow`, `service-flow`, `event-flow`, and `data-flow` diagrams.

1. Write a compact `DiagramSpec` JSON file in the workspace, usually under a project-local `diagrams/` or `examples/` directory.
2. Set `outputPath` in the spec to the target `.excalidraw` file.
3. Run:

```text
node <runtimeEntry> build <spec.json>
```

`build` now gates native Excalidraw editability before it reports success. It writes an editability report beside the scene.

4. Inspect the generated semantic summary:

```text
node <runtimeEntry> inspect <output.excalidraw>
```

5. Read the generated editability and quality reports, or regenerate them explicitly:

```text
node <runtimeEntry> editability-report <output.excalidraw>
node <runtimeEntry> quality-report <output.excalidraw> <spec.json>
```

6. Return the output path and summarize `editabilityPass`, `pass`, `structuralPass`, `familyPass`, and any important `suggestedPatches`.

Do not use `render` directly for normal new-diagram work. `build` runs render plus style, family layout, routing, route repair, native grouping/frame membership, validation, editability checking, and quality reporting.

### Existing diagram edit

1. Run:

```text
node <runtimeEntry> inspect <scene.excalidraw>
```

2. Write a `DiagramPatch` using semantic ids from the inspected summary.
3. Run:

```text
node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
```

4. Validate native editability and structural quality:

```text
node <runtimeEntry> editability-report <output.excalidraw>
node <runtimeEntry> validate <output.excalidraw>
node <runtimeEntry> quality-report <output.excalidraw> [spec.json]
```

Do not call `patch` for new diagrams.

### Sequence requests

Sequence diagrams use `SequenceSpec`, not graph-like `DiagramSpec`.

The dedicated sequence renderer is not implemented yet. Do not route sequence requests through the graph or flow renderer. For now, explain that sequence rendering is contract-only unless the user explicitly asks for a `SequenceSpec` draft rather than a rendered `.excalidraw` file.

## Route by task

- New diagram: read `guides/create.md`
- Existing diagram update: read `guides/edit.md`
- Visual polish or consistency: read `guides/style.md`
- Custom shape selection: read `catalog/shapes.index.json` first
- Contract details: read the relevant file in `contracts/`
- Visual hierarchy, lanes, or primary-flow planning: read `contracts/visual-plan.md`
- Structural quality failure or refinement: read `contracts/quality-report.md`
- Diagram-family selection: read `docs/DIAGRAM_TYPES.md`
- Acceptance review: read `docs/QUALITY_CRITERIA.md`

## Route by diagram family

- Whole HW/SW environment, layers, deployment, or module location: read `diagram-types/system-architecture.md`
- Internal blocks, ports, interfaces, or shared state of one module: read `diagram-types/module-architecture.md`
- Request, event, control, or data movement: read `diagram-types/flow.md`, then the relevant subtype such as `service-flow.md` or `event-flow.md`
- Ordered interactions over time: read `diagram-types/sequence.md` and `contracts/sequence-spec.md`

Legacy helpers:

- System or container overview compatible with the old lightweight C4 style: `diagram-types/c4-container-lite.md`

## Core contracts

- New graph-like scene: `DiagramSpec`
- New graph-like scene with layout intent: `DiagramSpec` v2 plus `Visual Plan`
- New sequence scene: `SequenceSpec`
- Existing scene summary: `SceneSummary`
- Existing scene update: `DiagramPatch`
- Rendered native-editability review: `EditabilityReport`
- Rendered structural review: `QualityReport`

## Hard rules

- Select the diagram family from the question the diagram must answer.
- Do not overload one scene with system, module, flow, and sequence concerns at once.
- Prefer the installed runtime over hand-written raw Excalidraw JSON.
- Use semantic ids for meaningful diagram objects.
- Preserve manual layout unless the user asks for a full relayout.
- Use team style presets instead of arbitrary visual choices.
- Express layout intent with semantic hints instead of raw coordinates.
- Treat an editability failure as a release blocker: node labels, arrows, frame membership, and generated component details must remain natively editable in Excalidraw.
- Treat a passing `QualityReport` as structural evidence, not aesthetic approval.
- When quality checks fail, make a small semantic patch instead of rewriting the full scene.
- Use Mermaid only as a temporary helper for simple flow-like reasoning.
- Never route sequence diagrams through the general graph layout engine.
- Do not read every guide by default.
- For new diagrams, do not run `patch`.
- For normal generation, do not run `render --help`, `validate --help`, or `patch --help` as a discovery loop; follow this router.
