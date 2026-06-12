# c4-container-lite

Use this diagram type for system context, container overview, and architecture review diagrams.

This is not strict C4 modeling. It is a lightweight architecture diagram optimized for editable Excalidraw output.

## Layout

Typical placement:

- users and clients on the left
- system boundary in the center
- core services inside the boundary
- data stores near the bottom
- external systems on the right
- shared concerns such as monitoring or identity in support frames

## Frames

Use frames for:

- system boundary
- public zone
- internal services
- data layer
- external dependencies

## Nodes

Prefer these shape families:

- `actor.user`
- `client.web`
- `client.mobile`
- `service.backend`
- `gateway.api`
- `database.relational`
- `external.system`

## Good default

Show boundaries and responsibilities before low-level request order.
