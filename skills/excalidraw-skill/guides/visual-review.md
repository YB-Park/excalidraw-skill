# Visual Review Guide

Use this guide after deterministic structural/editability checks have passed. A passing quality report is evidence, not aesthetic approval.

## Review command

For normal agent work, use the review happy path on the final `.excalidraw` scene:

```text
node <runtimeEntry> review <scene.excalidraw> [spec.json]
```

`review` runs deterministic validity/editability/quality checks, creates a portable PNG, verifies that the output has a real PNG signature, and writes a `.review.json` handoff with `requiresVisualReview: true` and the preview path. The command deliberately does not claim visual approval; only an image-capable host can perform that step.

For a standalone portable image without the full review bundle, `preview` remains available:

```text
node <runtimeEntry> preview <scene.excalidraw> -o <scene.preview.png>
```

The portable preview is a geometry/label/layout review image produced from the scene. It is intentionally portable and is not a pixel-identical substitute for Excalidraw's native renderer. CI native actual-render regression remains the final renderer ground truth.

Never use low-level `render` with a `.png` output path. `render` writes Excalidraw JSON only.

## LLM visual review

When the host can inspect images, open the preview PNG reported by `review` with the host's image/vision capability. Do not inspect raw PNG bytes or infer visual quality only from metrics.

Review the image before reading suggested fixes so the visual critique is not anchored by metric output.

Check exactly these concerns:

1. **Reading path** — the intended primary flow or hierarchy is obvious within a few seconds.
2. **Routing** — no surprising detours, self-crossings, node penetrations, avoidable long trunks, or confusing fan-out/fan-in geometry.
3. **Labels** — every node/edge label is legible and clearly belongs to the intended object; no label is stranded far from its edge.
4. **Composition** — whitespace, balance, aspect ratio, and visual density feel intentional rather than mechanically stretched.
5. **Boundaries and hierarchy** — frames, lanes, support concerns, primary nodes, and external/internal boundaries communicate semantic structure instead of visual clutter.

Classify defects as:

- `blocker`: misleading, unreadable, broken, or semantically wrong
- `major`: clearly awkward enough that a user would want it fixed before sharing
- `minor`: polish only; do not destabilize a good layout to remove it

## Refinement loop

Keep the loop bounded.

- New diagram: revise the DiagramSpec/Visual Plan and rebuild. Do not patch a brand-new diagram just to polish it.
- Existing diagram: make the smallest semantic patch that addresses the visual defect.
- Run `review` again after each change and inspect the fresh PNG.
- Prefer at most two visual refinement passes. If a defect persists, report it instead of endlessly perturbing the layout.
- Convert recurring dogfood defects into deterministic metrics, repair logic, or regression fixtures instead of relying forever on human/LLM taste.

If the host cannot inspect images, still run `review` and return its preview path, but explicitly state that visual approval was not performed.
