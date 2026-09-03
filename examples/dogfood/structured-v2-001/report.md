# Structured v2 dogfood report

## Purpose

This run replays the same three real flow-family scenarios used in the original cognitive dogfood after the sequence-safe Structured strategy fix merged at `3eeb528e9d717195021e4d379b01c47f5f80dc70`.

The goal is to separate three questions:

1. Did Structured move from deterministically invalid to valid?
2. After hard-gate recovery, is Structured perceptually competitive?
3. Can we preserve blind evaluation discipline without turning assistant judgments into human preference evidence?

## Scenarios

- payment approval
- order fulfillment
- observability pipeline

All three reuse the historical DiagramSpec inputs under `examples/dogfood/copilot-cloud-001/` so the comparison is against the same semantic tasks.

## Reproduction source

Production source commit: `3eeb528e9d717195021e4d379b01c47f5f80dc70`

Temporary verification branch head: `9a01583a91b4475df6292def965d33840d9ce33e`

Workflow run: `33711331560`

Artifact: `structured-v2-dogfood`

Artifact digest: `sha256:a687f0385906de909028350f21bcd60af21106769b9bd1a3e33aee79e887b0cc`

The temporary verification PR only added an unmergeable artifact-generation workflow. Production code was not changed by the verification run.

## Deterministic hard gates

The current candidate generator produced three candidates per scenario. All nine candidates passed:

- quality gate
- structural gate
- family gate
- editability gate
- route-integrity gate

For every candidate across all three scenarios:

- primary-flow ordering violations: `0`
- node overlaps: `0`
- edge-node crossings: `0`
- edge crossings: `0`
- endpoint approach violations: `0`
- endpoint node penetrations: `0`
- label-node overlaps: `0`

The historical Structured candidates from the first dogfood had primary-flow ordering violations of `2`, `4`, and `3` for payment approval, order fulfillment, and observability respectively. The replay is therefore a deterministic recovery from `2/4/3` to `0/0/0` on the same three semantic tasks.

`review.json` still correctly reports `requiresVisualReview: true` and `visualApprovalPerformed: false`; deterministic success is not treated as visual approval.

## Blind perceptual evaluation

Before reading strategy names from the manifests, the nine native Excalidraw-rendered PNGs were inspected using opaque candidate IDs only.

Rubric:

1. narrative clarity
2. semantic hierarchy
3. spatial coherence
4. visual economy
5. task comprehension

The rankings were frozen before strategy reveal.

### Payment approval

Blind ranking: `c03 > c02 > c01`

Confidence: medium-high.

`c03` had the strongest balance between a readable primary approval path and subordinate secondary concerns. `c02` was compact and usable but felt more compressed. `c01` preserved the story but used the available space less effectively.

### Order fulfillment

Blind ranking: `c03 > c02 > c01`

Confidence: high.

`c03` kept the fulfillment sequence immediately traceable while placing the retry/failure support relation without competing with the main story. `c02` was serviceable but denser; `c01` was the least economical.

### Observability pipeline

Blind ranking: `c03 > c02 > c01`

Confidence: high.

`c03` presented ingestion, processing, storage, and query/alert relationships with the clearest hierarchy and least visual competition. `c02` remained understandable but more compressed. `c01` was readable but visually less efficient.

## Strategy reveal

Only after rankings were frozen were the persisted manifests read.

For all three scenarios:

- `c01` = `narrative`
- `c02` = `compact`
- `c03` = `structured`

Therefore Structured ranked first in all three replay scenarios.

## Interpretation

The sequence-safe Structured fix achieved both intended outcomes in this replay:

- **invalid → valid:** yes. The repeated primary-flow ordering defect disappeared while all hard geometry, routing, editability, and family checks passed.
- **perceptually competitive:** yes in this three-task assistant blind review. Structured was ranked first in all three scenarios after actual native-render PNG inspection.

This does **not** establish a human preference distribution. The ranking is assistant perceptual evidence only and must not be written into `examples/evaluation/preference-corpus.json`.

The result is strong enough to keep Structured in the active flow candidate portfolio and to proceed with real human ranking collection rather than further deterministic tuning based solely on the original failure.

## Evidence discipline

- Historical dogfood evidence was not rewritten.
- No production code, thresholds, quality baselines, or preference corpus were changed by this evidence branch.
- Candidate IDs were kept opaque during image ranking.
- Strategy names were revealed only after rankings and confidence were frozen.
- Actual native-render PNGs were inspected by the assistant in this run.
- The assistant ranking is not labeled or stored as human preference evidence.

## Recommended next step

Begin real-use dogfood with the current main branch and collect explicit human rankings using `npm run preference:record`. The next product-quality question is no longer whether Structured is structurally safe; it is whether the candidate portfolio consistently produces a useful choice for humans across more varied real tasks.
