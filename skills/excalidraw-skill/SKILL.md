---
name: excalidraw-skill
description: Generate, inspect, update, visually review, and polish software diagrams using editable Excalidraw scenes, compact contracts, team style presets, and an installed user runtime.
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

- New diagram: read `guides/create.md`, write a `DiagramSpec`, run `build`, then run `review` and visually inspect its PNG when image vision is available.
- Existing diagram update: read `guides/edit.md`, run `inspect`, write a `DiagramPatch`, run `patch`, then run `review` and visually inspect its PNG when image vision is available.
- Visual review: read `guides/visual-review.md`; `review` is the normal deterministic-check + verified-PNG handoff.
- Visual polish of an existing diagram: read `guides/style.md` after inspecting the scene.
- Shape selection: read `catalog/shapes.index.json` only when choosing `shapeRef` values.

If the request is ambiguous, prefer the new-diagram workflow unless an existing `.excalidraw` path is present.

## Command recipes

### New graph-like diagram

Use this for `system-architecture`, `module-architecture`, `flow`, `service-flow`, `event-flow`, and `data-flow` diagrams.

1. Write a compact `DiagramSpec` JSON file in the workspace.
2. Set `outputPath` to the target `.excalidraw` file.
3. Build:

```text
node <runtimeEntry> build <spec.json>
```

4. Inspect when useful, then run the normal review happy path:

```text
node <runtimeEntry> inspect <output.excalidraw>
node <runtimeEntry> review <output.excalidraw> <spec.json>
```

`review` runs validity, native editability, and structural/family quality checks, creates a portable PNG, verifies that it is a real PNG, and writes a `.review.json` handoff with `requiresVisualReview: true`.

5. Read `guides/visual-review.md`. If the host can inspect images, visually inspect the PNG reported by `review` before reading suggested fixes. Fix blocker/major visual defects by revising the `DiagramSpec` or Visual Plan and rebuilding, then run `review` again. Prefer at most two visual refinement passes.
6. Return the `.excalidraw` path, `.review.json` path, preview path, quality summary, and whether visual approval was actually performed.

Do not use `render` directly for normal work. `render` is a low-level scene writer and produces Excalidraw JSON only; it never creates PNG images.

### Existing diagram edit

1. Inspect the scene:

```text
node <runtimeEntry> inspect <scene.excalidraw>
```

2. Write a `DiagramPatch` using semantic ids from the summary.
3. Apply the smallest semantic patch:

```text
node <runtimeEntry> patch <scene.excalidraw> <patch.json> [-o output.excalidraw]
```

4. Run the normal review happy path:

```text
node <runtimeEntry> review <output.excalidraw> [spec.json]
```

5. Read `guides/visual-review.md` and visually inspect the PNG reported by `review` when image vision is available. Verify locality, routing, labels, composition, and preservation of unrelated manual layout.

If a blocker/major visual defect remains, make the smallest semantic patch that addresses it and run `review` again. Do not rewrite unrelated manual layout. Prefer at most two visual refinement passes.

### Sequence requests

Sequence diagrams use `SequenceSpec`, not graph-like `DiagramSpec`.

The dedicated sequence renderer is not implemented yet. Do not route sequence requests through the graph or flow renderer. For now, explain that sequence rendering is contract-only unless the user explicitly asks for a `SequenceSpec` draft rather than a rendered `.excalidraw` file.

## Route by task

- New diagram: `guides/create.md`
- Existing diagram update: `guides/edit.md`
- Visual review after build/patch: `guides/visual-review.md`
- Visual polish or consistency: `guides/style.md`
- Custom shape selection: `catalog/shapes.index.json`
- Contract details: relevant file in `contracts/`
- Visual hierarchy, lanes, or primary-flow planning: `contracts/visual-plan.md`
- Structural quality failure or refinement: `contracts/quality-report.md`
- Diagram-family selection: `docs/DIAGRAM_TYPES.md`
- Acceptance criteria: `docs/QUALITY_CRITERIA.md`

## Route by diagram family

- Whole HW/SW environment, layers, deployment, or module location: `diagram-types/system-architecture.md`
- Internal blocks, ports, interfaces, or shared state of one module: `diagram-types/module-architecture.md`
- Request, event, control, or data movement: `diagram-types/flow.md`, then the relevant subtype
- Ordered interactions over time: `diagram-types/sequence.md` and `contracts/sequence-spec.md`

Legacy helper: `diagram-types/c4-container-lite.md` for old lightweight C4-compatible overviews.

## Core contracts

- New graph-like scene: `DiagramSpec`
- New graph-like scene with layout intent: `DiagramSpec` v2 plus `Visual Plan`
- New sequence scene: `SequenceSpec`
- Existing scene summary: `SceneSummary`
- Existing scene update: `DiagramPatch`
- Native-editability review: `EditabilityReport`
- Structural review: `QualityReport`
- Agent review handoff: `.review.json` plus verified portable PNG
- Human/LLM visual review: the PNG plus `guides/visual-review.md`

## Hard rules

- Select the diagram family from the question the diagram must answer.
- Do not overload one scene with system, module, flow, and sequence concerns at once.
- Prefer the installed runtime over hand-written raw Excalidraw JSON.
- Use semantic ids for meaningful diagram objects.
- Preserve manual layout unless the user asks for a full relayout.
- Use team style presets instead of arbitrary visual choices.
- Express layout intent with semantic hints instead of raw coordinates.
- Treat editability failures as release blockers.
- Treat a passing `QualityReport` as structural evidence, not aesthetic approval.
- For normal important/dogfood output, run `review` and visually inspect its verified PNG when the host supports image vision.
- `review` does not perform visual approval itself; `visualApprovalPerformed` remains false until the image-capable host actually inspects the PNG.
- Inspect the image before reading suggested fixes to reduce confirmation bias.
- Never use low-level `render` to create a PNG. It writes Excalidraw JSON only.
- Use `preview` directly only when a standalone portable PNG is specifically needed; prefer `review` for normal agent QA.
- Keep visual refinement bounded; prefer at most two passes.
- Turn recurring visual defects into deterministic metrics, repair logic, or regression fixtures.
- Use Mermaid only as a temporary helper for simple flow-like reasoning.
- Never route sequence diagrams through the general graph layout engine.
- Do not read every guide by default.
- For new diagrams, do not run `patch`.
- For normal generation, do not probe multiple `--help` commands; follow this router.
