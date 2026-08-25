# DiagramPatch

`DiagramPatch` is the compact contract for changing an existing diagram.

The agent writes this patch after reading a `SceneSummary`.

## Fields

- `version`
- `targetPath`
- `preserveManualLayout`
- `operations`

`preserveManualLayout` defaults to `true`. Unrelated nodes must keep their coordinates for local edits.

## Executable operations

The runtime implements every operation listed here. Unknown operations fail instead of being silently ignored.

### `addNode`

Required:

- `op: "addNode"`
- `semanticId`
- `label`
- `shapeRef`

Optional placement hints:

- `near`
- `side`: `left`, `right`, `up`, `down`
- `gap`

### `addEdge`

Required:

- `op: "addEdge"`
- `semanticId`
- `from`
- `to`

Optional:

- `label`
- `kind`

New edges use native Excalidraw source/target bindings.

### `updateLabel`

Required:

- `op: "updateLabel"`
- `target`: node semantic id
- `label`

The bound node text is updated without replacing the node semantic id.

### `moveNear`

Required:

- `op: "moveNear"`
- `target`
- `near`

Optional:

- `side`: `left`, `right`, `up`, `down`
- `gap`

The target node and its bound/generated local visual elements move together. Unrelated nodes remain fixed.

### `insertNodeBetween`

Required:

- `op: "insertNodeBetween"`
- `target`: semantic id of the edge to replace
- `semanticId`: semantic id of the new node
- `label`
- `shapeRef`

Optional:

- `inEdgeSemanticId`
- `outEdgeSemanticId`
- `inLabel`
- `outLabel`
- `inKind`
- `outKind`

The original edge is removed and replaced by two bound edges.

### `groupIntoFrame`

Required:

- `op: "groupIntoFrame"`
- `semanticId`: frame semantic id
- `members`: node semantic ids

Optional:

- `label`
- `padding`
- `boundaryIntent`

Member nodes and bound node labels receive native Excalidraw `frameId` membership.

### `applyStylePreset`

Required:

- `op: "applyStylePreset"`
- `preset`

Currently executable preset:

- `professional-software`

### `removeObject`

Required:

- `op: "removeObject"`
- `target`: semantic id of a node or edge

Removing a node also removes its bound label, connected semantic edges, and generated dependent objects that share its native group.

## Rules

- Default `preserveManualLayout` to true.
- Prefer small local changes.
- Do not replace the whole scene for a small edit.
- Use semantic ids from `SceneSummary` whenever possible.
- Patch output must preserve native text/arrow bindings.
- A documented operation must have a runtime implementation and regression test.
- Quality-report suggestions are diagnostic instructions. When an agent converts one into a patch, it must use one of the executable operations above.
