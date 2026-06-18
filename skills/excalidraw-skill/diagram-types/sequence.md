# sequence

Use this family when time ordering is the main story.

## Questions this diagram answers

- Which participant sends each message?
- In what order do messages occur?
- Which calls are synchronous, asynchronous, callbacks, or returns?
- Where do alternatives, optional paths, loops, retries, and timeouts occur?

## Views

### synchronous-sequence

Use for request/response interactions with nested calls and returns.

### asynchronous-sequence

Use for messages, callbacks, event delivery, and background processing.

### initialization-sequence

Use for startup, registration, discovery, binding, and readiness flows.

## Contract

Sequence diagrams use a dedicated model:

- `participants`: ordered actors, processes, threads, or modules
- `messages`: ordered interactions
- `fragments`: `alt`, `opt`, `loop`, `timeout`, or `retry` regions

Participant fields:

- `semanticId`
- `label`
- `kind`
- `order`

Message fields:

- `semanticId`
- `from`
- `to`
- `label`
- `kind`: `sync`, `async`, `return`, `callback`, or `signal`
- `order`
- optional `activation`: `start`, `end`, or `continue`

Fragment fields:

- `kind`
- `label`
- `messageIds`
- optional ordered branches

## Visual rules

- participant order is stable and explicit
- time always progresses downward
- message order must never be changed to shorten lines
- synchronous calls and returns must be visually paired when both are shown
- asynchronous messages must be visually distinct
- activation bars must align with the correct lifeline
- fragments must contain exactly the messages that belong to them
- labels must not overlap adjacent messages
- do not use the general service-flow router or arbitrary orthogonal detours

## Good default

Start with 3 to 6 participants and one scenario. Use fragments only for behavior that materially changes the scenario. Split very long scenarios into separate diagrams instead of compressing them.