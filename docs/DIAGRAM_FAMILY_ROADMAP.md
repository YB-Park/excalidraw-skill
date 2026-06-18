# Diagram Family Roadmap

The taxonomy, contracts, quality criteria, and evaluation suite are defined for four diagram families. Renderer implementation proceeds family by family so that one service-flow example does not define the visual grammar of every diagram.

## Foundation — complete

- four core families defined
- graph-like `DiagramSpec` generalized
- dedicated `SequenceSpec` defined
- 16-case evaluation suite added
- runnable and contract-only case statuses defined
- shared quality criteria added
- automated suite runner added
- structural and family-specific quality checks separated
- semantic relation styles added
- frame, text fitting, routing, and structural quality foundations available

## Current renderer status

### flow

Status: pilot renderer and automated evaluation fixtures are available.

Implemented foundations:

- `flow`, `service-flow`, `event-flow`, and `data-flow` enter the flow renderer
- layered, swimlane, and hub-and-spoke placement
- graph-aware edge routing
- collision-aware edge labels
- text fitting
- conservative frame generation
- semantic relation styles for calls, async messages, reads, writes, retries, and failures
- primary-flow order quality checks
- four runnable evaluation fixtures

Still required before family readiness:

- run the complete flow evaluation locally and inspect generated scenes
- fix any structural failures reported by the evaluator
- perform visual review for hierarchy, branch readability, and support-lane balance
- run two fresh LLM generations per case for strategy stability

### system-architecture

Status: `layered-system` pilot renderer implemented and connected to the build pipeline.

Implemented foundations:

- authoritative top-to-bottom layer ordering
- focus-module metadata
- multiple nodes per layer
- layer-aware node placement using final text-fitted sizes
- layerless external systems placed in a side column
- no-op isolation from flow diagrams
- semantic relation styling shared with other families
- family-specific checks for layer order, focus metadata, external placement, and frames
- one runnable layered-system fixture

Still required before family readiness:

- run and visually inspect the layered-system evaluation
- inspect cross-layer edge routing quality
- decide whether subtle layer bands improve readability
- implement and evaluate `deployment-view`
- implement and evaluate `context-view`

### module-architecture

Status: `component-view` pilot renderer implemented and connected to the build pipeline.

Implemented foundations:

- compact placement of internal responsibility blocks
- one explicit focus-module boundary
- external callers and providers placed outside the module boundary
- left and right external placement hints
- internal and external scope metadata
- family-specific checks for scope, boundary count, and external placement
- one runnable Connection Manager fixture
- no-op isolation from flow and system-architecture renderers

Still required before family readiness:

- run and visually inspect the component-view evaluation
- inspect internal edge routing and label density
- improve responsibility-aware placement beyond the initial compact grid
- implement shared-state placement rules
- implement and evaluate `internal-block`
- implement and evaluate `port-interface-view`

### sequence

Status: dedicated contract and evaluation cases defined; cases remain contract-only.

Required capabilities:

- explicit participant ordering
- vertical time axis
- sync, async, return, and callback messages
- activation bars
- alt, opt, loop, timeout, and retry fragments
- sequence-specific quality checks

The general flow renderer must never be used as a fallback for sequence diagrams.

## Automated evaluation

Run all runnable cases:

```text
npm run evaluate
```

Family filters:

```text
npm run evaluate:flow
npm run evaluate:system
npm run evaluate:module
```

The aggregate result is written to `examples/evaluation/results/latest.json`.

A runnable case passes only when both `structuralPass` and `familyPass` are true. Contract-only cases remain visible in the report but do not count as implemented renderers.

## Implementation order

1. Run the four flow fixtures and fix reported structural or visual problems.
2. Run the layered-system fixture and fix cross-layer routing or hierarchy problems.
3. Run the module component-view fixture and fix boundary, routing, or hierarchy problems.
4. Implement the dedicated sequence renderer.
5. Add deployment, context, shared-state, internal-block, and port-interface views after the first view of each family is stable.

## Change acceptance rule

A shared change to text fitting, routing, frames, colors, relation styles, serialization, or quality reporting must be checked against every affected runnable family.

A family-specific layout change must not alter another family's renderer.

Do not accept a change solely because one payment diagram improves.

## Definition of family readiness

A family is ready for pilot use when:

- all four evaluation cases produce the correct semantic contract
- the primary views have dedicated renderers and runnable fixtures
- structural and family-specific checks have zero blockers
- two fresh generations use a similar visual strategy
- each result needs only small local edits
- the family-specific rules are documented in the skill router
