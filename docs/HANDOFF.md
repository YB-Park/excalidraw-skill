# Handoff

## Goal
Raise generated Excalidraw diagram quality enough for real use. Quality first; do not expand sequence/deployment/context yet.

## Current baseline
- Work directly on `main`.
- Latest verified quality commit: `160db7cd17c9b22b546325514e580e50e5d4558f` (CI #224 fully green).
- Strict evaluation: **25 total / 15 runnable / 15 passed / 0 failed / 10 contract-only / 0 perceptual warnings**.
- Per-case `readabilityCost` budgets use `+4` tolerance; missing baselines and larger regressions fail.
- Actual Excalidraw regression covers **all 15 runnable cases** with exact dimensions + dHash tolerance and rejects unexpected/unbaselined PNGs.
- Patch/edit actual regression covers **7 manually accepted round trips**, including add/insert/remove/move/relabel/rewire operation classes, with exact coverage.
- A clean-workspace E2E test installs the managed runtime and runs `init → build → inspect → patch → validate/editability/quality` successfully without relying on the repo workspace.
- Current renderer beats the experimental ELK candidate on the quality corpus; ELK remains research-only.

## What is already in place
- Native editability/bindings, structural/editability/perceptual hard gates, zero-warning strict CI, readability budgets, and native-render visual signatures.
- Flow/module/system routing refinements: bundles, hub-spokes, endpoint integrity, support shelves, primary-spine repair, and collision-aware labels.
- Patch edits preserve insertion corridors/requested-side locality and use a hard-safe affected-edge route portfolio.
- Runtime style preset is the single source of truth for preset-owned visuals, with static duplicate-color guards.

## Immediate next work
1. Start a **contained dogfood pilot** on a real supported-family task; do not add more synthetic fixtures first.
2. Inspect the actual `.excalidraw` result and edit it through the patch path at least once.
3. Any real defect becomes a regression fixture/gate before the implementation fix is considered done.
4. Keep new diagram families out of scope until the current supported families survive dogfood cleanly.

## Rules for continuing
- Do not lower thresholds or refresh baselines just to green CI.
- Preserve semantics, native editability, and manual-layout stability as hard constraints.
- Prefer fewer bends / stronger continuity; a clean near-90° crossing is allowed when cheaper than a large detour.
- Keep this file short; update only when the verified baseline or next phase materially changes.
