# Handoff

## Goal
Raise generated Excalidraw diagram quality enough for real use. Quality first; do not expand sequence/deployment/context yet and do not call dogfood-ready prematurely.

## Current baseline
- Work directly on `main`.
- Latest verified quality commit: `4322b37ced36d4cd0d739e5dc10e5a3bef06e0f2`.
- Strict evaluation: **25 total / 15 runnable / 15 passed / 0 failed / 10 contract-only / 0 perceptual warnings**.
- Strict CI also enforces per-case `readabilityCost` baselines with a `+4` tolerance; improvements pass, missing baselines and larger regressions fail.
- Real Excalidraw renderer regression gate currently covers 7 representative PNGs with exact dimensions + dHash tolerance; latest verification passed.
- Current renderer beats the experimental ELK candidate on the quality corpus; ELK remains research-only.

## What is already in place
- Native editability/bindings, full patch operations, structural/editability/perceptual reports, shared layout scoring.
- Flow/module/system layout and routing refinements, including fan-out/fan-in bundles, hub-spokes, endpoint integrity, support shelves, and primary-spine repair.
- 15 materially different runnable topology fixtures.
- Zero-perceptual-warning strict gate + per-case readability regression budgets.
- Actual Excalidraw/Playwright render + visual signature verification.
- **Runtime style preset single source of truth is complete** for preset-owned canvas/base/frame/node/edge/font/label/component-detail visuals, with a static guard against duplicated runtime hex colors.

## Immediate next work
1. Expand actual Excalidraw renderer regression coverage from **7 representative scenes to all 15 runnable cases**.
2. Make the visual gate fail on unbaselined/unexpected PNGs so new render coverage cannot silently bypass review.
3. Then add visual regression coverage for representative **patch/edit round trips**, not only fresh builds.

## Rules for continuing
- Fix geometry/quality failures; do **not** lower thresholds or refresh baselines just to green CI.
- Preserve semantic correctness, native editability, and manual-layout stability as hard constraints.
- Prefer fewer bends / better path continuity, but allow a clean near-90° crossing when it is perceptually cheaper than a large detour.
- Keep ELK experimental until it can pass hard gates on the stress corpus.
- Keep this file short; update only when the verified baseline or immediate-next work materially changes.
