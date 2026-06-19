# Diagram Quality Criteria

Quality is evaluated in layers. A diagram is not accepted merely because it opens or passes structural validation.

## 1. Semantic correctness

Required for every diagram family:

- all required entities are present
- no unsupported entities are invented
- relation direction and relation kind are correct
- labels preserve the source terminology unless an explicit naming rule applies
- the selected diagram family answers the requested question
- hidden assumptions are stated or omitted rather than silently drawn as facts

## 2. Structural validity

Machine-checkable requirements:

- semantic ids are unique and stable
- references resolve to existing entities
- text does not overflow its node
- nodes do not overlap
- edges do not cross unrelated nodes
- endpoint segments do not overlap accidentally
- edge labels do not overlap nodes or each other
- visible boundaries contain their members
- excessive or meaningless frames are suppressed

A passing structural report is necessary but not sufficient.

## 3. Visual communication

Human or visual-review requirements:

- the diagram's entry point is obvious
- the main story can be explained within ten seconds
- visual hierarchy matches semantic importance
- supporting elements do not compete with the focus
- spacing communicates grouping before frames are added
- labels are readable at normal zoom
- line styles and arrow direction are understandable
- the composition is balanced without decorative clutter

## 4. Edit burden

Record the work needed to reach an acceptable result:

- number of node moves
- number of edge reroutes
- number of label edits
- number of frame removals or additions
- number of LLM refinement prompts
- approximate review time

The target is not zero edits. The target is that common diagrams require only small, local edits.

## 5. Stability

Generate the same request in at least two fresh LLM sessions.

Compare:

- selected diagram family
- included entities and relations
- primary structure or participant ordering
- number and meaning of visible boundaries
- style roles
- structural quality metrics

The exact geometry may differ. The semantic and visual strategy should remain similar.

# Family-specific criteria

## system-architecture

- HW, OS, middleware, service, and application layers are ordered correctly when present
- the focus module is identifiable without oversized decoration
- deployment, trust, ownership, and host boundaries are not conflated
- dependencies do not imply runtime calls unless the relation says so
- external systems remain visually outside internal boundaries
- layer bands or frames are used only when they clarify architecture

## module-architecture

- the module boundary is clear
- internal blocks represent responsibilities rather than arbitrary implementation details
- provided and required interfaces are distinguishable
- data and control relations are not visually conflated
- shared state is connected to its actual users
- the diagram does not become a miniature system overview

## flow

- one primary flow is visible when a main story exists
- direction is consistent
- branches and merges are understandable
- async flow is visually distinct from sync flow
- retry, error, and optional paths do not overpower the happy path
- data stores and queues appear near their owners or consumers

## sequence

- participant order is stable and meaningful
- time progresses downward
- messages are ordered correctly
- synchronous calls, returns, and async messages are distinguishable
- activations do not overlap incorrectly
- `alt`, `opt`, `loop`, timeout, and retry fragments contain the correct messages
- no general graph-layout rule moves a later message above an earlier message

# Acceptance levels

## Blocker

- semantic error
- unreadable or truncated text
- broken reference
- edge direction error
- incorrect participant order or message order
- node or label overlap that hides information

## Major

- important flow is visually secondary
- repeated edge overlap
- excessive frames
- ambiguous boundary meaning
- several manual reroutes required

## Minor

- small spacing imbalance
- one avoidable bend
- one label that could be positioned better
- optional cosmetic alignment

## Acceptable pilot result

- zero blockers
- at most one major issue
- no more than a few local edits
- similar semantic strategy across two fresh generations
