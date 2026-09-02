# Handoff

## Current phase
Contained dogfood / pre-release. The goal is to prove the existing supported families in real use without lowering the quality bar. Do **not** expand sequence/deployment/context yet.

Work directly on `main`.

Latest verified `main`: `cbc081e3801a509ac8b858b8f204fa0e8d9dbe9a` — CI #264 fully green.

## Supported surface
Renderable now:
- flow / service-flow / event-flow / data-flow: `layered-flow`, `swimlane-flow`, `hub-and-spoke`
- system-architecture: `layered-system`
- module-architecture: `component-view`

Not renderable yet: sequence, deployment/context views, internal-block/port-interface views. Do not silently fall back to another family.

`stylePreset` is optional. Omit it by default; runtime default is `professional-software`. If explicit, use only `professional-software`. Do not use or add a `default-software` alias.

## Quality baseline
- Strict evaluation: **25 total / 15 runnable / 15 passed / 10 contract-only / 0 perceptual warnings**.
- Per-case `readabilityCost` budgets: baseline +4 tolerance; missing or larger regressions fail CI.
- Native editability, structural geometry, endpoint integrity, family semantics, and perceptual quality are hard gates.
- Actual Excalidraw renderer regression covers **all 15 runnable fresh-build cases** with exact dimensions + dHash tolerance and exact PNG coverage.
- Patch/edit actual regression covers **7 manually accepted round trips** across add/insert/remove/move/relabel/rewire behavior, also with exact coverage.
- Clean-workspace installed-runtime E2E passes: `init → build → inspect → patch → validate/editability/quality`.
- Runtime style preset is the single source of truth for preset-owned visuals; duplicate style literals are guarded.

## Required user/agent workflow
New diagram:
1. Create a DiagramSpec for a supported family.
2. `build` the `.excalidraw` scene.
3. Run inspect/editability/quality checks.
4. Run `preview` to create a portable PNG and visually inspect it when the host supports images.
5. If a blocker/major visual defect exists, revise the spec/Visual Plan and rebuild; prefer at most two refinement passes.

Existing diagram:
1. `inspect` first.
2. Apply the smallest semantic `patch` with `preserveManualLayout: true` by default.
3. Re-run editability/quality checks.
4. Create and visually inspect a fresh PNG preview.

`preview` is for portable human/LLM visual review. It is not pixel-identical to native Excalidraw rendering; CI native actual-render regression is the renderer ground truth. Low-level `render` writes `.excalidraw` JSON only and must not be used as a PNG converter.

## Immediate next work
1. Run real contained dogfood tasks in supported families instead of adding synthetic fixtures preemptively.
2. For each real task, inspect the final PNG before metric suggestions; check reading path, routing, labels, composition, whitespace, and semantic boundaries.
3. Patch an existing real diagram at least once and verify visual locality/manual-layout preservation.
4. Any recurring real defect becomes a deterministic metric/repair/regression fixture before considering the fix complete.
5. Only consider broader family support after current families survive dogfood cleanly.

## Non-negotiables
- Do not lower thresholds or refresh baselines just to green CI.
- Do not accept a diagram on metrics alone; visual review is part of dogfood acceptance.
- Preserve semantics, native editability, and unrelated manual layout as hard constraints.
- Prefer fewer bends and stronger path continuity; a clean near-90° crossing can be better than a large detour.
- Keep this file as a live snapshot: replace stale state instead of appending history.
