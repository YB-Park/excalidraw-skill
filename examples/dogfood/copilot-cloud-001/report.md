# Cognitive flow-family dogfood — independent blind evaluation

## Outcome

This dogfood run generated three candidate portfolios for three real flow-family tasks and produced reproducible deterministic artifacts. The original Copilot cloud-agent session did not complete the required perceptual ranking. To finish the evaluation without inventing evidence, the existing PNG previews were recovered through a temporary CI artifact and independently inspected by the assistant.

The visual evaluation was performed **blind to strategy names**. Only opaque candidate IDs (`c01`, `c02`, `c03`) were used while inspecting the actual PNG pixels. Rankings were frozen before the candidate manifests were opened to reveal strategy identity.

This is assistant perceptual dogfood evidence. It is **not** human preference evidence and nothing from this run is added to the human preference corpus.

## Evaluation method

1. Generate the three existing candidates for each scenario.
2. Apply deterministic hard gates independently from visual judgment.
3. Inspect the actual candidate PNGs using opaque candidate IDs only.
4. Score exactly five perceptual dimensions on a 1–5 ordinal scale:
   - narrative clarity
   - semantic hierarchy
   - spatial coherence
   - visual economy
   - task comprehension
5. Freeze ranking, confidence, severity, and escalation recommendation.
6. Reveal candidate strategy names only after ranking.

Scores are directional evidence, not calibrated measurements. A deterministic hard-gate failure remains disqualifying regardless of perceptual score.

## Scenario 1 — Payment approval service flow

Blind ranking: **c01 > c02 >> c03**  
Confidence: **medium-high**  
Human decision recommended: **yes**, because c01 and c02 are both valid and reasonably close.

| Candidate | Narrative clarity | Semantic hierarchy | Spatial coherence | Visual economy | Task comprehension | Hard gate | Severity |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| c01 | 5 | 5 | 5 | 4 | 5 | pass | none |
| c02 | 4 | 4 | 5 | 5 | 4 | pass | minor |
| c03 | 2 | 3 | 2 | 3 | 2 | **fail** | major |

Visual notes:

- `c01` presents the primary story left-to-right with Checkout, Payment API, Card Network, and the final result immediately readable. Risk and audit concerns remain subordinate.
- `c02` preserves the story with less eye travel, but wrapping and tighter spacing make it slightly denser.
- `c03` requires substantial backtracking and scanning to reconstruct the intended left-to-right sequence. It is visually weaker and also fails the deterministic family gate with two primary-flow-order violations.

Strategy reveal after ranking: `c01 = narrative`, `c02 = compact`, `c03 = structured`.

## Scenario 2 — Order fulfillment event flow

Blind ranking: **c01 > c02 >> c03**  
Confidence: **high**  
Human decision recommended: **no**; c01 is the clearest valid candidate.

| Candidate | Narrative clarity | Semantic hierarchy | Spatial coherence | Visual economy | Task comprehension | Hard gate | Severity |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| c01 | 5 | 5 | 5 | 4 | 5 | pass | none |
| c02 | 4 | 4 | 5 | 5 | 4 | pass | minor |
| c03 | 2 | 3 | 2 | 2 | 2 | **fail** | major |

Visual notes:

- `c01` makes the primary sequence from Order Accepted through Customer Notification immediately legible while retry/operations paths remain secondary.
- `c02` is a viable compact alternative, but the tighter composition and more wrapped labels cost some scanability.
- `c03` has long detours and backtracking, and semantic label content on the left side is visibly clipped at the preview boundary. It also fails the deterministic family gate with four primary-flow-order violations.

Strategy reveal after ranking: `c01 = narrative`, `c02 = compact`, `c03 = structured`.

## Scenario 3 — Observability data flow

Blind ranking: **c02 > c01 >> c03**  
Confidence: **high**  
Human decision recommended: **no**; c02 is the strongest valid candidate.

| Candidate | Narrative clarity | Semantic hierarchy | Spatial coherence | Visual economy | Task comprehension | Hard gate | Severity |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| c01 | 4 | 4 | 4 | 3 | 4 | pass | minor |
| c02 | 5 | 4 | 5 | 5 | 5 | pass | none |
| c03 | 2 | 3 | 2 | 2 | 2 | **fail** | major |

Visual notes:

- `c01` has a clear ingestion/storage story but spreads the query/alert/archive consumers across a wider composition.
- `c02` keeps the same semantic story while grouping the branches around Telemetry Store more coherently and reducing eye travel.
- `c03` again introduces long detours/backtracking and visibly clips left-side semantic label content. It also fails deterministic quality with three primary-flow-order violations and one edge crossing.

Strategy reveal after ranking: `c01 = narrative`, `c02 = compact`, `c03 = structured`.

## Deterministic/perceptual separation

The winning candidates all pass structural and family quality gates with zero primary-flow-order violations, endpoint approach violations, endpoint penetrations, overlaps, and crossings in their recorded quality reports.

The structured candidate (`c03`) fails the family hard gate in all three scenarios:

- payment approval: 2 primary-flow-order violations
- order fulfillment: 4 primary-flow-order violations
- observability: 3 primary-flow-order violations, plus 1 edge crossing

This means the perceptual ranking did not rescue an invalid candidate. The hard filter and the visual critic independently point away from `c03` in these tasks.

The visual inspection additionally found preview-bound clipping in structured `c03` for order fulfillment and observability. The current deterministic reports do not represent that clipping as a dedicated metric. Because it recurred in two scenarios, it should be promoted to a deterministic preview-bounds/content-visibility invariant rather than treated as a one-off taste preference.

## Portfolio evidence

After blind ranking was frozen and strategies were revealed:

- narrative wins: **2 / 3**
- compact wins: **1 / 3**
- structured wins: **0 / 3**
- structured candidates with major visible clipping: **2 / 3**
- structured candidates failing hard family gates: **3 / 3**

This is not enough evidence to globally disable the structured strategy. It is enough evidence to say that the current structured/hub-and-spoke strategy is a poor fit for these strongly sequential tasks and needs stronger hard constraints before it can be treated as a competitive candidate.

## Tooling result

The native Copilot cloud-agent dogfood path was incomplete: it generated the candidate corpus and deterministic evidence but did not complete trustworthy image-based blind ranking. The assistant recovered the existing candidate PNGs through a temporary, non-merge verification CI artifact and performed the missing blind inspection directly.

Therefore:

- candidate generation: completed
- deterministic validation: completed
- actual PNG inspection: completed independently by the assistant
- blind opaque-ID ranking: completed
- strategy reveal after ranking: completed
- native Copilot cloud-agent end-to-end completion: **false**
- fabricated visual approval: **none**
- fabricated human preference: **none**

## Conclusion

The cognitive workflow is useful: candidate diversity produced meaningful alternatives, hard gates correctly disqualified the structured candidates, and perceptual inspection separated narrative from compact when both were valid. The main follow-up is deterministic: prevent semantic labels/content from being clipped by preview/scene bounds and tighten the structured strategy so it does not violate sequential primary-flow ordering.
