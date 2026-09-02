# Patch Usage

Use `patch` only for changing an existing `.excalidraw` scene. For a new diagram, use `build` instead.

## Required flow

Always inspect first so the patch uses semantic ids from the existing scene:

```text
node ./bin/excalidraw-skill.mjs inspect existing.excalidraw
```

Write a compact `DiagramPatch`, then apply it:

```text
node ./bin/excalidraw-skill.mjs patch existing.excalidraw change.patch.json -o updated.excalidraw
```

Review the result:

```text
node ./bin/excalidraw-skill.mjs editability-report updated.excalidraw
node ./bin/excalidraw-skill.mjs validate updated.excalidraw
node ./bin/excalidraw-skill.mjs quality-report updated.excalidraw
```

Patch itself runs native editability and structural safety gates. The explicit follow-up commands are useful for review and diagnostics.

## Supported operations

The runtime implements these semantic operations:

- `addNode`
- `addEdge`
- `updateLabel`
- `moveNear`
- `insertNodeBetween`
- `groupIntoFrame`
- `applyStylePreset`
- `removeObject`

Unknown operation names fail instead of being ignored.

The complete field contract is in `skills/excalidraw-skill/contracts/diagram-patch.md`.

## Example: rename one node

```json
{
  "version": "1.0",
  "preserveManualLayout": true,
  "operations": [
    {
      "op": "updateLabel",
      "target": "payment-service",
      "label": "Payment Authorization Service"
    }
  ]
}
```

The node keeps its semantic identity and native label binding. Connected edge geometry may be refreshed when the new label changes the node size, but unrelated node positions should remain fixed.

## Example: move one node locally

```json
{
  "version": "1.0",
  "preserveManualLayout": true,
  "operations": [
    {
      "op": "moveNear",
      "target": "settlement-worker",
      "near": "payment-events",
      "side": "down",
      "gap": 80
    }
  ]
}
```

## Example: remove an object

```json
{
  "version": "1.0",
  "preserveManualLayout": true,
  "operations": [
    {
      "op": "removeObject",
      "target": "settlement-worker"
    }
  ]
}
```

Removing a semantic node also removes its bound label and connected semantic edges.

## Edge rewiring

There is no separate `updateEdge` operation. Rewire a relationship by removing the existing semantic edge and adding a new edge, preferably reusing the semantic id when the relationship is conceptually the same object:

```json
{
  "version": "1.0",
  "preserveManualLayout": true,
  "operations": [
    {
      "op": "removeObject",
      "target": "events-to-worker"
    },
    {
      "op": "addEdge",
      "semanticId": "events-to-worker",
      "from": "payment-db",
      "to": "settlement-worker",
      "label": "settle",
      "kind": "sync"
    }
  ]
}
```

## Locality rules

`preserveManualLayout` defaults to true and should normally remain true for edits.

- prefer the smallest semantic change that satisfies the request
- do not regenerate the full scene for a local edit
- unrelated nodes should keep their positions
- connected/affected edges may be rerouted to preserve hard geometry constraints
- native text/arrow/frame/group editability must remain valid
- structural quality failures are blockers; do not bypass them just to produce output

## Visual regression status

The dogfood quality lab includes accepted actual-render round trips for representative add, insert, remove, move, relabel, and rewire edits. Passing those regressions protects known behavior, but a real user edit should still be visually reviewed when the diagram matters.
