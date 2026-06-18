# Evaluation Suite

This directory prevents development from overfitting to one payment-flow example.

The suite contains four diagram families:

- `system-architecture`
- `module-architecture`
- `flow`
- `sequence`

Each case defines:

- a short scenario
- the expected diagram family and view
- semantic invariants
- structural invariants
- visual-review questions

## How to run a case

1. Start a fresh LLM session.
2. Ask the agent to read `skills/excalidraw-skill/SKILL.md`.
3. Give the selected case prompt from `suite.json`.
4. Save the generated `DiagramSpec`, `.excalidraw`, and quality report.
5. Run the same case in a second fresh session.
6. Compare both results using `docs/QUALITY_CRITERIA.md`.

## What must remain stable

- selected family and view
- required entities
- required relation directions
- layer, boundary, or participant ordering
- meaning of visible boundaries
- primary flow or scenario ordering

Exact coordinates do not need to match.

## Development rule

A layout or style change should be evaluated against at least one case from every family it could affect.

Do not accept a change solely because the payment-flow case looks better.

## Initial acceptance target

For each case:

- zero semantic blockers
- zero text overflow
- zero hidden node overlap
- zero invalid references
- no more than one major visual issue
- only local manual edits needed

Sequence cases are contract tests until the dedicated sequence renderer exists. They must not be routed through the general flow engine.