# DiagramSpec

`DiagramSpec` is the compact graph-like contract for creating system-architecture, module-architecture, and flow diagrams.

Sequence diagrams use `SequenceSpec` instead.

The agent writes the contract. The local CLI renders it into an Excalidraw scene.

## Versions

- `1.0`: semantic nodes and relations with minimal high-level hints
- `2.0`: adds compact visual intent without raw coordinates

Use `2.0` when layout quality matters, when semantic ordering must be preserved, or when a diagram has a primary structure plus supporting concerns.

Machine-readable v2 schema: `diagram-spec-v2.schema.json`.
Visual planning rules: `visual-plan.md`.
Diagram-family rules: relevant file in `diagram-types/`.

## Supported graph-like families

- `system-architecture`
- `module-architecture`
- `flow`
- compatible subtypes such as `service-flow`, `event-flow`, `data-flow`, and `c4-container-lite`

Do not encode `sequence` with this contract.

## Required fields

- `version`
- `diagramType`
- `title`
- `stylePreset`
- `nodes`
- `edges`
- `outputPath`

## Optional top-level fields

Common:

- `layout`
- `groups`
- `framePolicy`

System architecture may add:

- `architecture.focus`
- `architecture.layers`
- `architecture.deployments`

Module architecture may add:

- `module.focusModule`
- `module.boundaryLabel`
- `module.externalPorts`

Flow may add:

- `layout.primaryFlow`
- `layout.lanes`

## Layout profiles

Flow profiles:

- `layered-flow`
- `hub-and-spoke`
- `swimlane-flow`

System-architecture profiles:

- `layered-system`
- `deployment-view`
- `context-view`

Module-architecture profiles:

- `component-view`
- `internal-block`
- `port-interface-view`

Each renderer owns its family-specific interpretation. A profile from one family must not silently control another family.

## Node fields

Common fields:

- `semanticId`
- `label`
- `kind`
- `shapeRef`
- `group`
- `fontRole`
- `layoutHints`

Useful family-specific semantic hints may include:

- system architecture: `layer`, `deployment`, `hostRole`
- module architecture: `responsibility`, `visibility`, `componentRole`
- flow: `lane`, `rank`, `importance`

## Edge fields

Common fields:

- `semanticId`
- `from`
- `to`
- `label`
- `kind`
- `fontRole`
- optional `visual`
- optional `routeHints`

Prefer explicit semantic relation kinds:

- `calls`
- `returns`
- `depends-on`
- `references`
- `contains`
- `publishes`
- `subscribes`
- `reads`
- `writes`
- `transfers`
- `interrupts`
- `controls`

Do not collapse all relations into a generic arrow when the distinction matters.

### Edge visual intent

Use `edge.visual` for semantic styling intent. Do not use raw colors, raw coordinates, or arbitrary Excalidraw style values in the spec.

Allowed fields:

- `visual.role`: `default`, `data-plane`, `control-plane`, `event-stream`, `error-path`, `dependency`, `muted`
- `visual.emphasis`: `normal`, `strong`, `critical`, `muted`
- `visual.stroke`: `solid`, `dashed`, `dotted`

Examples:

```json
{
  "semanticId": "data-to-pipeline",
  "from": "collector",
  "to": "pipeline",
  "kind": "transfers",
  "visual": { "role": "data-plane", "emphasis": "critical", "stroke": "solid" }
}
```

```json
{
  "semanticId": "events-to-worker",
  "from": "topic",
  "to": "worker",
  "kind": "publishes",
  "visual": { "role": "event-stream", "stroke": "dashed" }
}
```

## Rules

- Select the diagram family before writing the spec.
- Use semantic ids, not raw Excalidraw element ids.
- Use shape refs from the catalog.
- Use a style preset instead of arbitrary visual values.
- Do not put raw coordinates in DiagramSpec.
- Use `edge.visual` instead of raw edge color/width/style values.
- Preserve semantic ordering such as layer order and flow order.
- Treat lanes and logical groups as invisible by default.
- Use visible frames only for meaningful boundaries.
- Use layout and route hints only when they express real visual intent.
- Let the family renderer own exact positions, bends, label offsets, ports, frames, and Excalidraw details.
- Evaluate cross-cutting changes against `examples/evaluation/suite.json`.
