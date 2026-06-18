# Diagram Family Roadmap

The taxonomy, contracts, quality criteria, and evaluation suite are defined for four diagram families. Renderer implementation proceeds family by family so that one service-flow example does not define the visual grammar of every diagram.

## Foundation — complete

- four core families defined
- graph-like `DiagramSpec` generalized
- dedicated `SequenceSpec` defined
- 16-case evaluation suite added
- shared quality criteria added
- frame, text fitting, routing, and structural quality foundations available

## Current renderer status

### flow

Status: pilot implementation available.

Implemented foundations:

- service-flow visual planning
- layered, swimlane, and hub-and-spoke placement
- graph-aware edge routing
- collision-aware edge labels
- text fitting
- conservative frame generation
- structural quality report

Still requires evaluation against all four flow cases.

### system-architecture

Status: contract and evaluation cases defined; dedicated renderer not implemented yet.

First target: `layered-system`.

Required capabilities:

- authoritative layer ordering
- focus-module emphasis
- semantic relation styles
- optional layer bands
- cross-layer edge channels
- external/internal placement

Second targets:

- `deployment-view`
- `context-view`

### module-architecture

Status: contract and evaluation cases defined; dedicated renderer not implemented yet.

First target: `component-view`.

Required capabilities:

- one focus-module boundary
- external collaborators outside
- responsibility-based internal blocks
- shared-state placement
- control/data relation distinction

Second targets:

- `internal-block`
- `port-interface-view`

### sequence

Status: dedicated contract and evaluation cases defined; renderer not implemented yet.

Required capabilities:

- explicit participant ordering
- vertical time axis
- sync, async, return, and callback messages
- activation bars
- alt, opt, loop, timeout, and retry fragments
- sequence-specific quality checks

The general flow renderer must never be used as a fallback for sequence diagrams.

## Implementation order

1. Validate the existing flow renderer against all four flow evaluation cases.
2. Implement `system-architecture / layered-system`.
3. Implement `module-architecture / component-view`.
4. Implement the dedicated sequence renderer.
5. Add the remaining views only after each first view passes its family evaluation cases.

## Change acceptance rule

A shared change to text fitting, routing, frames, colors, or serialization must be checked against every affected family.

A family-specific layout change must not alter another family's renderer.

Do not accept a change solely because one payment diagram improves.

## Definition of family readiness

A family is ready for pilot use when:

- all four evaluation cases produce the correct semantic contract
- at least the primary view has a dedicated renderer
- structural checks have zero blockers
- two fresh generations use a similar visual strategy
- each result needs only small local edits
- the family-specific rules are documented in the skill router
