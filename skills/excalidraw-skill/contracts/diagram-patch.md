# DiagramPatch

`DiagramPatch` is the compact contract for changing an existing diagram.

The agent writes this patch after reading a `SceneSummary`.

## Fields

- `version`
- `targetPath`
- `preserveManualLayout`
- `operations`

## Operation families

- `addNode`
- `addEdge`
- `updateLabel`
- `moveNear`
- `insertNodeBetween`
- `groupIntoFrame`
- `applyStylePreset`
- `removeObject`

## Operation fields

Common operation fields:

- `op`
- `semanticId`
- `target`
- `label`
- `shapeRef`
- `from`
- `to`
- `near`
- `side`
- `reason`

## Rules

- Default `preserveManualLayout` to true.
- Prefer small local changes.
- Do not replace the whole scene for a small edit.
- Use semantic ids from `SceneSummary` whenever possible.
