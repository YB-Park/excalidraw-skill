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
- an implementation status
- an optional runnable fixture

## Automated evaluation

Run every currently runnable case:

```text
npm run evaluate
```

Run only flow cases:

```text
npm run evaluate:flow
```

Run only system-architecture cases:

```text
npm run evaluate:system
```

The evaluator builds each runnable fixture, reads its quality report, and writes the aggregate result to:

```text
examples/evaluation/results/latest.json
```

A runnable case passes only when both are true:

- `structuralPass`: generic overlap, crossing, routing, label, text, and aspect checks pass
- `familyPass`: family-specific order, focus, frame, boundary, or primary-flow checks pass

## Case statuses

- `runnable`: a fixture and supported renderer exist; the evaluator builds and checks the case
- `contract-only`: the scenario remains an active contract test, but its dedicated renderer is not implemented yet
- `missing-fixture`: a case was marked runnable but its fixture is absent; this fails the evaluation run

Contract-only cases are reported but do not create a false pass for an unimplemented renderer.

## Fresh-generation review

Automated fixtures test renderer behavior. They do not replace LLM stability review.

1. Start a fresh LLM session.
2. Ask the agent to read `skills/excalidraw-skill/SKILL.md`.
3. Give the selected case prompt from `suite.json`.
4. Save the generated contract, `.excalidraw`, and quality report.
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

For each runnable case:

- zero semantic blockers
- zero text overflow
- zero hidden node overlap
- zero invalid references
- no unsupported family or view fallback
- no more than one major visual issue after screen review
- only local manual edits needed

Sequence cases remain contract-only until the dedicated sequence renderer exists. They must never be routed through the general flow engine.
