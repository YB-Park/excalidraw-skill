# Handoff: Native Excalidraw PNG export fidelity

Status: active investigation on PR #33 (`fix/headless-font-fidelity`).

## User-visible problem

PNG output from the repository renderer does not always look identical to exporting the same scene from Excalidraw itself. Observed differences include fonts, arrow appearance, boxes/rough strokes, and general simplification.

Treat this as a native-export fidelity problem, not only a font problem.

## Current repository state

- Base `main`: `8ac386a17d12bdaa6aa593c249f64c4315bed9b6`
- PR: #33 `Improve headless PNG font fidelity`
- Branch: `fix/headless-font-fidelity`
- Current head at handoff: `c94c9be009656ced4da0006443520b4c070aa638`
- Latest CI at handoff: run #379 / run id `33828589745`
- CI result: failure only at `Verify patch round-trip actual signatures`; all earlier unit/smoke/quality/A-B/native-render stages succeeded.
- CI artifact: `visual-review`, artifact id `9920951933`.

## Confirmed findings

### 1. The old final PNG path was not the native Blob

The renderer previously did approximately:

```text
scene
  -> @excalidraw/excalidraw exportToBlob()
  -> display resulting PNG in an <img>
  -> Playwright screenshot()
  -> final PNG
```

PR #33 changes this to:

```text
scene
  -> @excalidraw/excalidraw exportToBlob()
  -> write the Blob PNG bytes directly
  -> final PNG
```

This direct-Blob direction should be retained unless new evidence disproves it.

A same-environment A/B showed that, for the tested small scene, the drawing pixels were effectively unchanged while the old screenshot path introduced about 22 px of extra outer whitespace. This proves the second raster/screenshot pass was unnecessary and made the result less faithful to native export.

### 2. The old harness also imposed a maximum dimension

The old harness limited the long side to roughly 1800 px. This is not equivalent to normal native Excalidraw export and can alter rasterized rough strokes, arrowheads, and boxes on larger diagrams.

The intended fix is to stop imposing this renderer-specific downscale and honor Excalidraw's export scale/options instead.

A regression fixture larger than 1800 px is still needed to prove this remains fixed.

### 3. Explicit FontFace preloading did NOT improve output

An A/B experiment explicitly preloaded registered FontFace entries before export.

Result for the diagnostic scene:

```text
changed pixels = 0
before/after SHA-256 = identical
```

Therefore do not keep explicit font preloading merely because it sounds safer. It did not improve the tested PNG.

After export, Cascadia, Excalifont, Xiaolai and related Excalidraw fonts were observed as loaded, so this is not simply a case of `document.fonts.ready` being omitted.

### 4. Remaining font mismatch may be environment/version skew

The repository currently renders with `@excalidraw/excalidraw` 0.18.1. A current Excalidraw web application can use newer rendering/font/fallback behavior.

There can also be system/CJK fallback differences between a user's local browser and remote/headless Linux Chromium. In particular, system-backed normal/sans fonts can differ even when the `.excalidraw` scene is identical.

Do not claim that direct Blob output alone guarantees byte-identical output with current excalidraw.com. Matching Excalidraw version, export options, fonts/fallbacks, browser platform, and scene normalization can all matter.

## Current CI failure

CI #379 succeeded through:

- `npm test`
- smoke tests
- cognitive portfolio
- strict quality gates
- layout comparison
- deterministic previews
- Chromium installation
- `A/B native export fidelity`
- patch review scene generation
- patch actual PNG export

It failed at:

```text
Verify patch round-trip actual signatures
```

This is expected to be an image-signature baseline mismatch caused by changing the final PNG path from a Playwright screenshot to the direct Excalidraw Blob. Do not blindly update baselines: inspect the artifact PNGs first and confirm the differences are expected.

## Next actions

1. Download artifact `9920951933` from CI #379.
2. Inspect the generated patch PNGs visually and obtain the exact signature mismatch values from job `100886482895`.
3. Confirm changes are explained by direct native Blob output rather than a rendering regression.
4. Update deterministic image signature baselines only after that inspection.
5. Add a fidelity fixture whose exported dimension exceeds 1800 px.
6. The fixture should exercise at least rectangle/rounded rectangle, roughness, arrow and arrowheads, bindings, ellipse/diamond, and Latin + Korean text.
7. Add a regression assertion proving the large scene is no longer silently downscaled to the old 1800 px limit.
8. Remove experimental explicit FontFace preload code that produced no pixel change; retain useful diagnostics only if they have ongoing test/debug value.
9. Replace temporary A/B CI plumbing with focused permanent regression coverage once conclusions are established.
10. Run the full CI suite.
11. Only merge PR #33 after CI is green and actual PNG artifacts have been inspected.
12. After merge, verify the main-branch post-merge CI.

## Acceptance principle

Do not accept `looks close enough` as the renderer contract.

The immediate invariant should be:

```text
Excalidraw exportToBlob PNG bytes
        -> repository final PNG bytes
```

with no repository-added rasterization or arbitrary resize between those two points.

For true parity with the user's local Excalidraw export, obtain a PNG exported by the user from the same `.excalidraw` scene and compare it against the headless result. That is the strongest end-to-end reference for remaining version/platform/font differences.
