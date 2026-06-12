# event-flow

Use this diagram type for async events, Kafka topics, queues, pub/sub, stream processing, and producer-consumer diagrams.

## Layout

Default direction: left to right.

Typical placement:

- producers on the left
- topics or queues in the middle
- consumers on the right
- storage and side effects near the owning consumer
- monitoring or retry flows in a lower support frame

## Nodes

Prefer these shape families:

- `service.backend`
- `queue.topic`
- `queue.dead-letter`
- `worker.consumer`
- `database.relational`
- `external.system`

## Edges

- publish: solid or async arrow into a topic
- consume: async arrow out of a topic
- retry or fallback: dashed arrow

## Good default

Make event names visible. Do not overload the diagram with every payload field.
