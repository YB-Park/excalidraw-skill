# SequenceSpec

`SequenceSpec` is the dedicated contract for sequence diagrams. Do not encode a sequence as generic graph nodes and edges.

## Required fields

- `version`
- `diagramType`: `sequence`
- `title`
- `stylePreset`
- `participants`
- `messages`
- `outputPath`

## Participants

Each participant contains:

- `semanticId`
- `label`
- `kind`: `actor`, `process`, `thread`, `module`, `service`, `database`, or `external`
- `order`: non-negative integer

Participant order is authoritative. The renderer must not reorder participants to shorten messages.

## Messages

Each message contains:

- `semanticId`
- `from`
- `to`
- `label`
- `kind`: `sync`, `async`, `return`, `callback`, or `signal`
- `order`: non-negative integer
- optional `activation`: `start`, `continue`, or `end`

Message order is authoritative and time progresses downward.

## Fragments

Optional `fragments` contain:

- `semanticId`
- `kind`: `alt`, `opt`, `loop`, `timeout`, or `retry`
- `label`
- `messageIds`
- optional `branches`

A branch contains:

- `label`
- `messageIds`

Fragments must not refer to unknown messages. A message should not belong to unrelated overlapping fragments.

## Rules

- use 3 to 6 participants for the default view
- preserve source terminology
- do not infer a return message unless it matters to the scenario
- use `async` for fire-and-forget messages and `callback` for a later invocation back to an earlier participant
- use fragments only for behavior that changes the scenario
- never add x/y coordinates
- never use general flow `layout.profile` or `routeHints`

## Example

```json
{
  "version": "1.0",
  "diagramType": "sequence",
  "title": "Middleware Initialization",
  "stylePreset": "professional-software",
  "participants": [
    {"semanticId": "system-manager", "label": "System Manager", "kind": "process", "order": 0},
    {"semanticId": "middleware", "label": "Middleware", "kind": "module", "order": 1},
    {"semanticId": "device-adapter", "label": "Device Adapter", "kind": "module", "order": 2}
  ],
  "messages": [
    {"semanticId": "start", "from": "system-manager", "to": "middleware", "label": "start()", "kind": "sync", "order": 0},
    {"semanticId": "initialize", "from": "middleware", "to": "device-adapter", "label": "initialize()", "kind": "sync", "order": 1},
    {"semanticId": "ready", "from": "device-adapter", "to": "middleware", "label": "ready", "kind": "callback", "order": 2}
  ],
  "outputPath": "middleware-initialization.excalidraw"
}
```