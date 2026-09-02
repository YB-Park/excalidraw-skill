# Cognitive Agent Architecture

## Decision

The project is no longer trying to encode all visual quality as deterministic layout rules.

The architecture is intentionally split into three layers:

1. **Deterministic kernel** — prevents invalid diagrams and preserves semantics/editability.
2. **Cognitive design agent** — explores multiple valid presentations and performs perceptual judgment with uncertainty.
3. **Human art direction** — owns final visual intent and may directly manipulate the editable scene.

The design principle is:

> The kernel prevents invalid diagrams. The agent explores understandable diagrams. The human owns final visual intent.

This is an additive evolution of the existing skill/runtime, not a replacement. The current semantic IDs, family contracts, routing integrity, editability checks, patch locality, preview generation, and native-render regression remain valuable hard foundations.

## What stays deterministic

Deterministic checks remain authoritative for conditions with crisp truth values, including semantic references, native editability, endpoint/binding integrity, frame containment, invalid overlaps, label fit, unsupported family fallback, and preservation of unrelated manual layout.

A structural defect that recurs should become an invariant, repair, and regression test.

## What is no longer treated as deterministic truth

Global composition, visual hierarchy, storytelling, perceived centrality, whitespace quality, support-path prominence, and overall comprehension are perceptual judgments. They may use metrics as evidence, but a scalar such as `readabilityCost` is a suspicion signal rather than a definition of quality.

A recurring perceptual preference should become preference evidence, a candidate strategy, or a human correction pattern. It should not automatically become another hard rule.

## Candidate portfolio

Important new diagrams are explored through a deliberately small portfolio of meaningfully different strategies:

- `narrative` — preserve the clearest primary story and subordinate secondary concerns.
- `compact` — reduce eye travel and spread while preserving correctness.
- `structured` — emphasize semantic grouping and hierarchy over compactness.

The first implementation keeps the portfolio at three candidates to control cost and judge instability. Random coordinate jitter is not a strategy.

Each candidate must pass deterministic build/review gates before perceptual ranking. A candidate that violates a hard gate is not rescued by an LLM preference.

## Perceptual critic protocol

The critic is a noisy sensor, not an oracle.

For every candidate it independently inspects the actual PNG and evaluates exactly five dimensions before doing any ranking:

1. Narrative clarity.
2. Semantic hierarchy.
3. Spatial coherence.
4. Visual economy.
5. Task comprehension.

The critic must expose confidence. Low confidence, close candidates, or presentation-critical tasks escalate to the human instead of forcing an automated winner.

The generator/coordinator and critic are separate agent roles so that generation intent does not become hidden ranking evidence.

## Human-in-the-loop and LayoutState

Manual layout is product input, not automation failure.

`DiagramSpec` remains semantic source material. `LayoutState` stores presentation decisions keyed by stable semantic node ID. A human-moved node can therefore be preserved across later semantic regeneration without baking coordinates into the semantic specification.

The first LayoutState contract captures locked node positions and moves bound node labels with the node. A fresh review is required after reapplication. More expressive relative constraints can be added only when real dogfood demonstrates the need.

## VS Code native agent architecture

The first host is VS Code native Copilot customization rather than a custom extension.

- `Excalidraw Designer` is the user-facing coordinator.
- `Excalidraw Planner` is a read-only semantic subagent.
- `Excalidraw Critic` is a multimodal perceptual subagent.
- the local `excalidraw` MCP server exposes semantic tools instead of raw renderer internals.

The MCP surface begins with:

- `diagram_candidates`
- `diagram_review_image`
- `diagram_validate`
- `diagram_capture_layout_state`
- `diagram_apply_layout_state`

`diagram_review_image` returns the actual PNG as MCP image content plus structured review evidence. The agent must not claim visual approval from JSON metrics alone.

## Model-cost policy

Agent files must explicitly list only low-cost models. The initial allow-list is:

- GPT-5.6 Luna
- MAI-Code-1.1-Flash
- Kimi K2.7 Code

Designer and Planner prefer Luna. Critic prefers MAI-Code-1.1-Flash because image understanding is part of its documented capability. Model names are configuration, not architecture: future substitutions must preserve the cheap-tier rule and required capabilities.

No agent may silently escalate to a more expensive model.

## Evaluation model

Quality is measured using three distinct suites rather than one blended score.

### Kernel Contract Suite

Deterministic. Existing unit, smoke, strict structural/family gates, editability, routing, patch locality, and actual-render regression remain required.

### Cognitive Preference Suite

Statistical. A curated set of real tasks records human-ranked candidates and reasons. The critic is measured on top-1 agreement, pairwise agreement, repeat/order stability, confidence calibration, and human-escalation rate. One judge call is never treated as ground truth.

### Interaction Suite

Mixed deterministic/perceptual. A human arrangement is captured, semantics are changed, LayoutState is reapplied, unrelated presentation intent is preserved, and the result is freshly reviewed.

## Current vertical slice and boundaries

This first slice intentionally does not rewrite every family renderer or remove existing heuristic passes. It creates the architectural seams needed to measure the new approach without destabilizing the proven kernel.

Candidate strategy behavior is initially most differentiated for flow families. Broader family-specific strategy portfolios should be added only after preference evidence shows what diversity is useful.

Do not expand unsupported diagram families as part of this architecture migration.

## Promotion rule

After enough real examples exist:

- structural failure -> deterministic invariant/test;
- repeated human visual correction -> candidate-strategy or LayoutState improvement;
- repeated critic/human preference -> preference corpus evidence;
- ambiguous preference -> remain human/agent judgment;
- metric that correlates poorly with human preference -> demote or remove it from selection logic.
