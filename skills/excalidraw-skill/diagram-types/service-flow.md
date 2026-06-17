# service-flow

Use this diagram type for service calls, request flows, dependencies, and backend architecture explanations.

## Default layout

Default direction: left to right.

Typical placement:

- user or client on the left
- gateway or public API next
- core services in the center
- databases, caches, queues near their owning service
- external systems on the right or outside a frame

## v0.3 layout profiles

Use DiagramSpec v2 and `contracts/visual-plan.md` when the flow is visually non-trivial.

### layered-flow

Use for a mostly linear request path.

- keep the primary path on one main rank sequence
- place supporting systems above or below the main path
- prefer direct edges for the primary path

### swimlane-flow

Use when primary and supporting concerns must be separated.

Typical lanes:

- main request path
- data and risk support
- async or background processing

Do not place databases, queues, or background workers directly in the primary lane unless they are the main story.

### hub-and-spoke

Use when one service is the clear center of many relationships.

- put the hub at the center
- group internal callers separately from external providers
- keep data and queue components close to the hub
- avoid making every edge share the same entry point

## Visual planning rules

- define one ordered `primaryFlow` when a clear happy path exists
- use `layoutHints.lane` and `layoutHints.rank` instead of coordinates
- use `keepNear` for owned databases, queues, and support services
- reserve `routeHints` for important exceptions
- mark primary edges with `routeHints.priority: primary`
- move supporting edge labels away from the primary reading path

## Nodes

Prefer these shape families:

- `client.web`
- `gateway.api`
- `service.backend`
- `database.relational`
- `cache.redis`
- `queue.topic`
- `external.system`

## Edges

- sync call: solid arrow
- optional call: dashed arrow
- async event: use `event-flow` if it becomes the main story

## Good default

Keep one main happy path. Put failures, alternatives, data access, and async support outside that path when possible.
