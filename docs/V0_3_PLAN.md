# v0.3 — Hybrid Visual Planning and Layout

## Goal

Improve diagram quality without abandoning the compact, editable, deterministic Excalidraw pipeline.

v0.3 separates three responsibilities:

1. The LLM describes diagram meaning.
2. The LLM adds compact visual intent without raw coordinates.
3. The local renderer owns exact placement, routing, labels, and Excalidraw details.

The renderer may later produce a quality report and request a small local patch instead of regenerating the whole scene.

## Non-goals

- Do not make the LLM write full Excalidraw JSON by default.
- Do not support every diagram type in the first v0.3 pass.
- Do not add arbitrary colors, fonts, or coordinates to DiagramSpec.
- Do not build a general-purpose graph layout engine before proving the service-flow use case.

## Scope order

### M0 — Benchmark baseline

Create repeatable prompts and review criteria before changing layout behavior.

Measure:

- build and validation success
- node overlap count
- edge-to-node crossing count
- edge-to-edge crossing count
- label overlap count
- excessive aspect ratio
- manual edits required before the diagram is usable
- approximate LLM input and output size
- subjective readability and visual hierarchy

Compare three modes when practical:

- A: v0.2 compact DiagramSpec and current renderer
- B: v0.3 DiagramSpec with Visual Plan and improved renderer
- C: direct full-scene generation as an experiment, not the default

### M1 — DiagramSpec v2 Visual Plan

Add compact high-level layout intent:

- layout profile
- direction
- preferred aspect ratio
- primary flow
- lanes
- node lane, rank, importance, keep-near, and keep-apart hints
- edge direction, priority, and label-side hints

The contract must remain smaller and safer than raw Excalidraw JSON.

### M2 — Service-flow layout profiles

Implement only these first:

- layered-flow
- hub-and-spoke
- swimlane-flow

The payment-flow benchmark is the primary acceptance case.

### M3 — Graph-aware routing

Route all edges as a set instead of treating each edge independently.

Required foundation:

- reserve the primary flow first
- allocate separate bypass lanes
- offset edges sharing a route
- avoid nodes and occupied label areas
- prefer simple routes over decorative bends

### M4 — Label placement

Check collisions between:

- labels and nodes
- labels and labels
- labels and edges
- labels and frames

### M5 — Quality report and local refinement

Produce a machine-readable quality report. When thresholds fail, allow an LLM to make a small semantic patch rather than rewriting the whole Excalidraw scene.

## Initial acceptance criteria

The service-flow payment benchmark should:

- keep the primary request path visually obvious
- place supporting data, risk, and async components away from the primary path
- avoid routing through nodes
- avoid overlapping edge labels
- remain editable as a normal `.excalidraw` file
- keep stable semantic ids
- require fewer manual edits than the v0.2 result

## Freeze rule

v0.2 receives only critical bug fixes. All visual-quality work belongs to v0.3.
