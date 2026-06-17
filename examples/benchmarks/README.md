# v0.3 Benchmark Suite

Use these prompts to compare diagram-generation strategies with the same input.

## Modes

- `A`: v0.2 compact DiagramSpec and current renderer
- `B`: v0.3 DiagramSpec v2 with Visual Plan
- `C`: direct full Excalidraw generation, experimental only

## Required outputs

For every run, record:

- model name
- prompt file
- generated contract or scene
- final `.excalidraw` file
- build result
- validation result
- approximate input/output token usage when available
- manual edits required before the diagram is usable

## Review metrics

Count or score:

- node overlaps
- edge-to-node crossings
- edge-to-edge crossings
- label overlaps
- excessive width or height
- primary-flow clarity
- visual hierarchy
- consistency with the professional-software style
- editability and semantic-id preservation

## Suggested rating

Use a 1–5 score for:

- readability
- visual hierarchy
- professionalism
- consistency
- manual-edit effort

## Acceptance target for v0.3

Mode B should outperform Mode A on readability and manual-edit effort without approaching Mode C token cost or structural failure rate.
