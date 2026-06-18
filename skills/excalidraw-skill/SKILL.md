---
name: excalidraw-skill
description: Generate, inspect, update, and polish software diagrams using editable Excalidraw scenes, compact contracts, team style presets, and a local CLI.
---

# Excalidraw Skill Router

This is the only top-level skill the agent should select for Excalidraw diagram work.

Keep this file small. Read only the guide files needed for the current task.

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
- Rendered structural review: `QualityReport`

## Hard rules

- Select the diagram family from the question the diagram must answer.
- Do not overload one scene with system, module, flow, and sequence concerns at once.
- Prefer the local CLI over hand-written raw Excalidraw JSON.
- Use semantic ids for meaningful diagram objects.
- Preserve manual layout unless the user asks for a full relayout.
- Use team style presets instead of arbitrary visual choices.
- Express layout intent with semantic hints instead of raw coordinates.
- Treat a passing `QualityReport` as structural evidence, not aesthetic approval.
- When quality checks fail, make a small semantic patch instead of rewriting the full scene.
- Use Mermaid only as a temporary helper for simple flow-like reasoning.
- Never route sequence diagrams through the general graph layout engine.
- Test cross-cutting changes against `examples/evaluation/suite.json`, not only the payment example.
- Do not read every guide by default.