# Handoff

## Goal
Raise generated Excalidraw diagram quality enough for real use. Quality first; do not expand sequence/deployment/context yet and do not call dogfood-ready prematurely.

## Current baseline
- Work directly on `main`.
- Latest verified quality commit: `7d48bba310dcbeed87dc8e98387f24b8a1e6dfc3` (CI #215 fully green).
- Strict evaluation: **25 total / 15 runnable / 15 passed / 0 failed / 10 contract-only / 0 perceptual warnings**.
- Strict CI enforces per-case `readabilityCost` baselines with a `+4` tolerance; improvements pass, missing baselines and larger regressions fail.
- Real Excalidraw renderer regression now covers **all 15 runnable cases** with exact dimensions + dHash tolerance and rejects unexpected/unbaselined PNGs.
- Patch/edit actual-render regression separately covers **3 manually accepted payment round trips** (`add-audit`, `local-edit`, `insert-auth`) with the same exact coverage rule.
- Current renderer beats the experimental ELK candidate on the quality corpus; ELK remains research-only.

## What is already in place
- Native editability/bindings, full patch operations, structural/editability/perceptual reports, shared layout scoring.
- Flow/module/system layout and routing refinements, including fan-out/fan-in bundles, hub-spokes, endpoint integrity, support shelves, and primary-spine repair.
- 15 materially different runnable topology fixtures, zero-perceptual-warning strict gate, and per-case readability regression budgets.
- Actual Excalidraw/Playwright render + visual signature verification for both fresh builds and representative patch round trips.
- Patch placement/routing now preserves insertion corridors, keeps requested-side `addNode` placement local, and runs a hard-safe affected-edge route portfolio after edits.
- Latest accepted patch reference: `payment-to-audit` improved from **3 bends / 789px / route cost 79.8** to **2 bends / 763px / route cost 50.09**, with zero structural crossings; `insert-auth` preserves the primary horizontal spine.
- Runtime style preset single source of truth is complete for preset-owned canvas/base/frame/node/edge/font/label/component-detail visuals, with a static guard against duplicated runtime hex colors.

## Immediate next work
1. Expand the patch round-trip corpus by **operation class**, not by new diagram family: representative `removeObject`, `moveNear`, `updateLabel`, and edge-edit cases.
2. Keep actual-render manual inspection as the acceptance step before adding or refreshing any patch visual baseline.
3. Use those patch cases to surface and fix locality/continuity defects without weakening structural/editability/perceptual gates; revisit dogfood readiness only after this quality lab is stable.

## Rules for continuing
- Fix geometry/quality failures; do **not** lower thresholds or refresh baselines just to green CI.
- Preserve semantic correctness, native editability, and manual-layout stability as hard constraints.
- Prefer fewer bends / better path continuity, but allow a clean near-90° crossing when it is perceptually cheaper than a large detour.
- Keep ELK experimental until it can pass hard gates on the stress corpus.
- Keep this file short; update only when the verified baseline or immediate-next work materially changes.
