# Handoff

## Goal
Raise generated Excalidraw diagram quality enough for real use. Quality first; do not expand sequence/deployment/context yet and do not call dogfood-ready prematurely.

## Current baseline
- Work directly on `main`.
- Latest verified CI before this doc: **green** at `5e9e52f584cb577345b6532643cd082c6a0a8047`.
- Strict evaluation baseline: **25 total / 15 runnable / 15 passed / 0 failed / 10 contract-only / 0 perceptual warnings**.
- Real Excalidraw renderer regression gate exists for 7 representative PNGs; verified baseline had matching dimensions and dHash distance 0.
- Current renderer beats the experimental ELK candidate on the quality corpus; ELK remains research-only.

## What is already in place
- Native node-label and arrow bindings, grouping/frame membership, full patch operation support.
- Structural/editability/perceptual quality reports and shared layout scoring.
- Flow ordering, edge-routing, position refinement, fan-out/fan-in and module hub-spoke repairs.
- 15 materially different runnable topology fixtures.
- Strict CI gate for zero perceptual warnings.
- Actual Excalidraw/Playwright render + visual signature verification.
- Runtime style preset resolver introduced; renderer, node styling, edge styling, patch path, fonts, and edge-label styling now read from `professional-software.json`.

## Immediate next work
1. Finish **style preset single source of truth**: remaining visual constants are mainly in `src/frame-groups.mjs` and `src/apply-components.mjs`.
2. Re-scan runtime for duplicated style/color constants and remove only genuine preset-owned duplication.
3. Run full strict CI and require the 15 runnable cases plus 7 actual-render signatures to remain green; do not update visual baselines unless the visual change is intentionally reviewed.
4. Then add per-case readability-cost regression budgets so quality cannot silently degrade while staying below warning thresholds.

## Rules for continuing
- Fix geometry/quality failures; do **not** lower thresholds just to green CI.
- Preserve semantic correctness, native editability, and manual-layout stability as hard constraints.
- Prefer fewer bends / better path continuity, but allow a clean near-90° crossing when it is perceptually cheaper than a large detour.
- Keep ELK experimental until it can pass hard gates on the stress corpus.
- Keep this file short; update only the baseline and immediate-next section when the session state materially changes.
