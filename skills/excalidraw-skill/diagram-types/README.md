# Diagram Type Matrix

Use this matrix to route a user request before creating a DiagramSpec.

## Supported diagram types

| Type | Use when | Layout family | Core shapes |
| --- | --- | --- | --- |
| architecture-context | Show system scope, users, and external systems | boundary | actor, system, external, boundary |
| architecture-container | Show applications, services, data stores, queues, and integrations | boundary | client, gateway, service, data, queue, external |
| architecture-component | Show modules inside one service or container | graph | component, adapter, repository, boundary |
| service-flow | Show request or dependency flow between services | graph | client, gateway, service, data, external |
| event-flow | Show async publish/consume flows | graph | producer, topic, consumer, dlq, retry |
| sequence-flow | Show time-ordered interactions | timeline | participant, lifeline, activation, message |
| data-flow | Show data movement, transformation, and lineage | graph | source, stream, transform, lake, warehouse |
| deployment-view | Show runtime infrastructure and network boundaries | boundary | region, network, cluster, workload, managed data |
| state-machine | Show lifecycle states and transitions | model | state, initial, terminal, transition |
| domain-model | Show domain entities and relationships | model | entity, value-object, aggregate, relationship |
| process-flow | Show business or operational workflow | model | start, task, decision, parallel, end, swimlane |

## Routing rules

- Prefer one diagram type per output.
- If the request asks for both structure and sequence, suggest two diagrams.
- If time order is central, use `sequence-flow`.
- If runtime placement is central, use `deployment-view`.
- If data ownership or schema is central, use `domain-model`.
- If data movement is central, use `data-flow`.
- If lifecycle states are central, use `state-machine`.

## Visual rules

- All types use the same style preset family.
- Shape color is role-based, not model-chosen.
- Use built-in Excalidraw primitives first.
- Custom libraries are optional future enhancement, not required for v0.2.
