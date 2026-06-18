# system-architecture

Use this family when the diagram must explain where a middleware or software module lives in the whole HW/SW environment.

## Questions this diagram answers

- Which hardware, host, OS, process, or runtime contains each component?
- Which layer owns or invokes the focus module?
- Which dependencies are above, below, internal, or external?
- Which boundaries are deployment, trust, ownership, or host boundaries?

## Views

### layered-system

Use for HW → OS → middleware → application layering.

- vertical order is semantic and must be preserved
- a component must not appear in a higher layer merely to shorten an edge
- references across several layers should use clean channels
- the focus module may receive stronger emphasis, but not a larger arbitrary scale

### deployment-view

Use for hosts, devices, processes, containers, and workloads.

- visible frames represent actual deployment containers or devices
- software nodes must remain inside their deployment target
- external devices and systems remain outside internal deployment boundaries
- distinguish runtime communication from static dependency

### context-view

Use for the focus system and its major neighbors.

- place the focus system centrally
- keep only major users, providers, devices, and peer systems
- do not expose internal blocks unless they are essential to the context question

## Recommended semantic fields

Top-level `architecture` may contain:

- `focus`: semantic ids to emphasize
- `layers`: ordered layer definitions
- `deployments`: deployment boundary definitions

Node fields may include:

- `layer`
- `deployment`
- `hostRole`
- `importance`

Relations should use explicit kinds such as:

- `calls`
- `depends-on`
- `references`
- `contains`
- `reads`
- `writes`
- `interrupts`
- `transfers`

Do not use one generic arrow kind for all relations.

## Visual rules

- prefer semantic layer order over shortest-edge placement
- visible boundaries require real meaning
- use whitespace before adding frames
- do not create one frame per layer unless the layer bands are the main story
- external systems should not be placed inside internal deployment frames
- dependencies may be dashed; runtime calls should remain visually distinct
- keep the focus module identifiable without making every neighbor visually weak

## Good default

For middleware work, use `layered-system` with a small number of ordered layers and one clearly marked focus module. Add deployment frames only when host or process placement matters.