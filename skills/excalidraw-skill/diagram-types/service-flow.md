# service-flow

Use this diagram type for service calls, request flows, dependencies, and backend architecture explanations.

## Layout

Default direction: left to right.

Typical placement:

- user or client on the left
- gateway or public API next
- core services in the center
- databases, caches, queues near their owning service
- external systems on the right or outside a frame

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

Keep one main happy path. Put failures or alternatives in a separate frame.
