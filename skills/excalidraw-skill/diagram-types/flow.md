# flow

Use this family when movement of requests, events, data, or control is the main story.

## Subtypes

- `service-flow`: synchronous requests, dependencies, and backend interactions
- `event-flow`: producers, topics, queues, consumers, retries, and dead-letter paths
- `data-flow`: sources, transformations, buffers, stores, and sinks

## Questions this diagram answers

- Where does the flow start and end?
- Which path is primary?
- Where does the flow branch, merge, retry, or fail?
- Which interactions are synchronous, asynchronous, optional, or persistent?

## Layout profiles

- `layered-flow`: mostly linear progression
- `swimlane-flow`: primary and supporting concerns separated by placement
- `hub-and-spoke`: one central component with many relationships

## Recommended semantic fields

Top-level `layout` may include:

- `primaryFlow`
- `lanes`
- `direction`
- `aspectRatio`

Node hints:

- `lane`
- `rank`
- `importance`
- `keepNear`
- `keepApart`

Relation kinds:

- `calls`
- `returns`
- `publishes`
- `subscribes`
- `reads`
- `writes`
- `transfers`
- `retries`
- `fails-to`

## Visual rules

- one main flow should dominate when a happy path exists
- sync and async relations must be visually distinct
- supporting storage and risk checks should not become accidental primary steps
- branches must be readable without tracing several overlapping edge segments
- error and retry paths should remain secondary unless they are the review focus
- visible frames are optional and must communicate a real boundary

## Good default

Use `service-flow` for request-driven middleware interactions, `event-flow` for pub/sub or queued processing, and `data-flow` for transformation pipelines. Split a diagram when two of those stories compete for attention.