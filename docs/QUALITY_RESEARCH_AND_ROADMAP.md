# Quality Research and Roadmap

Status: active research plan for pre-dogfood quality work.

## Product position

The project should not enter broad dogfood merely because generated `.excalidraw` files are structurally valid. The quality bar is: a diagram should communicate its main story quickly, preserve semantic intent, remain natively editable, and require little or no manual rerouting/rebalancing.

This document separates **hard correctness**, **perceptual readability**, and **subjective visual acceptance** so that improvements in one layer cannot masquerade as overall quality.

## External research reviewed

### Graph drawing cognition

Ware, Purchase, Colpoys, and McGill, *Cognitive Measurements of Graph Aesthetics* (Information Visualization, 2002) found that path continuity and edge crossings are both important to graph-reading performance. A practical implication for this project is that eliminating every crossing at the cost of extremely long or bend-heavy routes is not necessarily a readability win.

- https://doi.org/10.1057/palgrave.ivs.9500013

### Graphviz / Sugiyama-style layered layout

Graphviz `dot` uses a staged directed-graph layout process: ranking, crossing minimization, coordinate assignment/compaction, and edge routing. It exposes rank spacing, node spacing, grouping, ordering, and crossing-minimization controls rather than treating layout as one monolithic operation.

- https://graphviz.org/docs/layouts/dot/
- https://graphviz.org/pdf/libguide.pdf

### Eclipse Layout Kernel (ELK)

ELK Layered is a mature Sugiyama-style layout implementation with explicit phases and options for crossing minimization, node placement, orthogonal routing, compound graphs, ports, model-order stability, partitions, and straightness priorities. It is especially relevant because software diagrams often need explicit attachment sides and stable directional flow.

- https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
- https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html
- https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html
- https://www.npmjs.com/package/elkjs

### Excalidraw visual regression practice

The official `mermaid-to-excalidraw` project maintains visual tests with Playwright in addition to code-level tests. This supports treating rendered appearance as a separately versioned regression surface.

- https://github.com/excalidraw/mermaid-to-excalidraw

## Quality model

### Layer A — semantic correctness (hard gate)

- all intended nodes and relations exist
- relation semantics and visual roles are preserved
- family-specific invariants pass
- unsupported family/profile combinations fail explicitly

### Layer B — Excalidraw native editability (hard gate)

- node labels are container-bound
- arrows are bound to source and target nodes
- reciprocal `boundElements` references are maintained
- component decoration is grouped with its semantic parent
- frame membership is native and internally consistent

### Layer C — structural geometry (hard gate)

- no node overlap
- no edge-through-node routing
- no endpoint-segment overlap
- no label overlap / text overflow
- bounded edge crossings
- valid endpoint approach directions

### Layer D — perceptual readability (advisory now, future calibrated gate)

New metrics:

- total and average edge bends
- primary-flow bends
- route detour ratio: routed orthogonal length / minimal orthogonal length
- severe and moderate detours
- primary-flow average detour ratio
- composition density
- composition balance offset
- project-specific readability cost for candidate comparison

The readability cost is intentionally a **relative project metric**, not a scientific time estimate. It is used to compare alternative layouts of the same semantic diagram.

### Layer E — subjective visual acceptance (human / visual model gate)

Questions that remain difficult to reduce to geometry alone:

- Is the entry point obvious in 2–3 seconds?
- Is the main story explainable in ~10 seconds?
- Does visual hierarchy match semantic importance?
- Is whitespace grouping natural rather than merely collision-free?
- Do support relationships look subordinate to the primary flow?
- Does the composition look intentionally designed rather than algorithmically scattered?

## Core architectural change: candidate search, not one-shot layout

The target generation flow is:

```text
DiagramSpec
  -> normalize semantics
  -> generate N layout candidates
       - current family heuristic
       - ELK layered variants
       - later: local-search / constrained variants
  -> reject candidates that fail hard gates
  -> rank survivors by perceptual readability cost
  -> render visual previews
  -> select / refine best candidate
  -> compile native Excalidraw elements
```

This differs from the current one-shot pipeline in one important way: the layout engine is no longer trusted to produce the final answer in one attempt.

## ELK experiment policy

`elkjs` is introduced as a **research candidate**, not as the production default.

The first flow experiment maps:

- semantic `rank` -> ELK partition
- route direction hints -> fixed-side ports
- primary flow -> high edge straightness priority
- lane/rank model order -> preferred model order
- routing -> orthogonal
- crossing minimization -> layer sweep + greedy switch
- deterministic random seed -> stable experiments

A fixture is won by ELK only if:

1. editability passes,
2. structural quality passes,
3. family quality passes,
4. perceptual readability cost is materially better (or warnings are fewer).

If ELK wins only some topologies, the likely production architecture is **portfolio layout**: choose an engine/profile by topology instead of forcing one renderer onto every family.

## Planned experiments

### Q1. Calibrate perceptual thresholds

Run all runnable fixtures and record distributions for bends, detour ratios, density, balance, and readability cost. Add 15–30 new adversarial fixtures before turning advisory metrics into hard gates.

Target fixture classes:

- straight primary chain + multiple support branches
- fan-out / fan-in
- diamond branch-merge
- retry + dead-letter path
- asymmetric read/write dependencies
- two data stores with shared writer
- dense module internals
- mixed Korean/English long labels
- 5 / 8 / 12 / 16-node scale tiers
- reverse/back edges

### Q2. Multi-profile ELK search

Benchmark at least these combinations:

- Brandes-Koepf vs Network Simplex node placement
- layer sweep vs median layer sweep crossing minimization
- straightness priority low/high
- spacing compact/normal/roomy
- model-order preference on/off

Do not expose these options to the LLM. They belong to the deterministic planner.

### Q3. Local refinement after layout

After a candidate engine returns positions:

- swap nodes within a lane/rank when cost falls
- nudge support nodes toward their semantic parent
- compact excessive whitespace
- spread high-degree ports
- shorten safe detours
- preserve the main flow axis

Each refinement is accepted only if hard metrics do not regress and readability cost improves.

### Q4. Real-render visual snapshots

The current deterministic SVG preview is useful for review but is not the actual Excalidraw renderer. Add Playwright snapshots using `@excalidraw/excalidraw` or a small test harness so font metrics, arrowheads, roughness, frame rendering, bindings, and labels are reviewed from the same renderer users see.

### Q5. Style system as a runtime source of truth

Move hard-coded role colors, fonts, stroke widths, radii, node gaps, and frame styling into a resolved theme object. The renderer and quality checks should consume the same resolved style tokens.

### Q6. Bounded automatic refinement loop

Future production build:

```text
candidate -> quality -> semantic/local repairs -> quality
```

Limit to 2–3 refinement rounds. Never allow a general LLM rewrite of coordinates after deterministic layout; patches should express semantic/local intent.

## Pre-dogfood exit criteria

Dogfood should begin only when all of the following are true:

- all runnable fixtures pass semantic, editability, and structural gates
- expanded corpus contains at least 15 materially different runnable topologies
- no representative fixture has severe primary-flow detours
- visual snapshots are generated with the real Excalidraw renderer
- representative visual review shows no recurring long-detour / awkward-port pattern
- layout candidate selection is deterministic
- at least one alternative layout strategy has been benchmarked against the current engine
- style preset is resolved through one runtime source of truth

## Current decision

Do **not** expand sequence/deployment/context coverage yet. The near-term priority is making existing flow/system/module output noticeably better and objectively measurable before expanding diagram-family surface area.
