# QualityReport

`QualityReport` is the v0.3 structural review contract for a rendered Excalidraw scene.

It is a deterministic proxy for common diagram failures. It is not an aesthetic verdict and does not prove that a diagram is visually excellent.

## Output

A normal build writes:

```text
<scene>.quality.json
```

Core fields:

- `version`
- `pass`
- `diagramType`
- `layoutProfile`
- `metrics`
- `details`
- `suggestedPatches`

## Structural metrics

The initial report measures:

- node overlaps
- edge-to-node crossings
- edge-to-edge crossings
- edge-label overlaps
- edge-label-to-node overlaps
- diagram aspect ratio
- node, edge, and edge-label counts

A passing report means that the configured structural thresholds passed. It does not measure taste, semantic correctness, visual storytelling, brand quality, or whether a human reviewer finds the result attractive.

## Refinement workflow

When `pass` is false:

1. Read `suggestedPatches` and the related semantic ids.
2. Create a small `DiagramPatch` or update the compact `DiagramSpec` hints.
3. Do not rewrite the full Excalidraw scene.
4. Do not introduce raw coordinates into an LLM-authored contract.
5. Render and measure again.
6. Keep the refinement loop local and small.

Examples of semantic suggestions:

- `move-apart`
- `reroute-edge`
- `separate-edge-labels`
- `move-edge-label`
- `change-layout-aspect`

## Limits

A human or visual model must still review:

- whether the primary story is immediately understandable
- whether the visual hierarchy feels natural
- whether grouping and spacing look professional
- whether icons and shapes communicate the intended meaning
- whether the final composition is aesthetically satisfactory

Treat structural metrics as evidence, not as approval of the final image.
