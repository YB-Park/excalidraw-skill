# vNext Test Strategy

## Goal

The test system must answer four different questions independently:

1. Is the semantic contract valid?
2. Is the generated Excalidraw scene structurally correct and natively editable?
3. Does a small semantic edit preserve the scene and produce a valid local change?
4. Does the rendered diagram communicate the intended visual story well enough for human use?

A single `pass` flag must never hide which layer failed.

## Test layers

### T0 — Contract tests

Fast, deterministic tests for JSON contracts and public agent-facing behavior.

Required coverage:

- DiagramSpec required fields and allowed enum values
- semantic id uniqueness
- edge references resolve to nodes
- supported family/profile combinations
- SceneSummary fields match the documented contract
- DiagramPatch operations match the documented contract and runtime implementation

These tests should fail before layout/rendering begins.

### T1 — Renderer unit tests

Test one rendering responsibility at a time.

Required coverage:

- text fitting and wrapping
- role/style mapping
- family layout placement
- route selection
- frame policy
- edge-label placement
- font policy

The output geometry may be asserted only where geometry is itself the contract.

### T2 — Native editability invariants

Every generated scene must behave like a normal Excalidraw document, not just look correct in a static export.

Required invariants:

- node label text is bound to its container
- a node lists its bound label in `boundElements`
- connected arrows use `startBinding` / `endBinding`
- connected nodes list bound arrows
- generated component decorations share a native `groupId` with their node
- frames use native `frameId` membership when members are framed
- deleting a semantic node can remove dependent generated objects cleanly

These invariants are release blockers because manual editability is a primary product goal.

### T3 — Patch / inspect round-trip tests

For every documented patch operation:

1. build or create a small scene
2. inspect it
3. apply one patch
4. inspect again
5. validate semantic ids, bindings, and unaffected geometry

Minimum patch matrix:

- `addNode`
- `addEdge`
- `updateLabel`
- `moveNear`
- `insertNodeBetween`
- `groupIntoFrame`
- `applyStylePreset`
- `removeObject`

`preserveManualLayout: true` means objects unrelated to the patch keep their original coordinates.

### T4 — Family end-to-end fixtures

Each runnable family needs multiple fixtures, not one golden example.

Current minimum:

- flow: linear, branch/merge, retry/DLQ, data pipeline, multilane support concerns
- system-architecture: layered stack with focus, external dependency
- module-architecture: component view with one module boundary and external caller

Each fixture must pass:

- build
- validate
- structural quality
- family quality
- editability invariant scan

Sequence remains contract-only until its renderer exists.

### T5 — Visual regression and human acceptance

Structural metrics are necessary but not sufficient. A diagram can have zero overlaps and still be visually poor.

The visual harness should export a deterministic SVG or PNG for selected fixtures and retain review baselines. Visual review should score:

- main story visible within 3–10 seconds
- primary flow carries the strongest visual hierarchy
- support concerns remain visually secondary
- whitespace and grouping are balanced
- no awkward long detours or decorative routing
- labels are readable at normal zoom
- the composition is appropriate for design review

Image-diff thresholds should catch accidental regressions, but a human can approve intentional visual changes by updating the baseline.

## CI gates

### Pull request gate

Run on every PR:

```text
npm test
npm run smoke
npm run smoke:system
npm run smoke:module
npm run evaluate
```

Later, add `npm run test:visual` when deterministic rendering is available in CI.

### Release gate

A release candidate requires:

- all T0–T4 automated tests pass
- zero editability blockers
- zero semantic blockers
- no more than one major visual issue per acceptance fixture
- fresh-generation review in two independent agent sessions for at least one fixture per runnable family

## Failure reporting

Reports should preserve separate statuses:

- `contractPass`
- `structuralPass`
- `familyPass`
- `editabilityPass`
- `visualReviewStatus`

Do not collapse these into aesthetic approval.

## Development rule

When fixing a bug, add the smallest regression test that reproduces it before or with the fix. A layout/style change must be checked against every family it can affect. Do not accept a change solely because the payment flow looks better.
