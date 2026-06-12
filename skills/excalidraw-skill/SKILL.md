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

## Route by diagram type

- Service dependency or request flow: read `diagram-types/service-flow.md`
- Async events, pub/sub, Kafka, queues: read `diagram-types/event-flow.md`
- System or container overview: read `diagram-types/c4-container-lite.md`

## Core contracts

- New scene: `DiagramSpec`
- Existing scene summary: `SceneSummary`
- Existing scene update: `DiagramPatch`

## Hard rules

- Prefer the local CLI over hand-written raw Excalidraw JSON.
- Use semantic ids for meaningful diagram objects.
- Preserve manual layout unless the user asks for a full relayout.
- Use team style presets instead of arbitrary visual choices.
- Use Mermaid only as a temporary helper for simple flow-like reasoning.
- Do not read every guide by default.
