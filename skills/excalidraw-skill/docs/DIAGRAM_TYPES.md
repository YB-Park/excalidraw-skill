# Diagram Types

This project supports four core software-diagram families. Choose the family from the question the diagram must answer, not from the shapes that happen to appear.

## 1. system-architecture

Primary question: **Where does our software or middleware module live in the whole HW/SW system, and how does it relate to surrounding layers, processes, devices, and external systems?**

Typical content:

- hardware, device, SoC, host, or execution target
- bootloader, OS, kernel, driver, middleware, service, and application layers
- processes, containers, runtime workloads, and external systems
- deployment, trust, ownership, or host boundaries
- calls, depends-on, reads, writes, interrupts, and data-transfer relationships
- one or more focus modules that must stand out without dominating the entire diagram

Preferred views:

- `layered-system`: vertical HW → OS → middleware → application layering
- `deployment-view`: hosts, processes, workloads, and external devices
- `context-view`: the focus system and its major neighbors

Visible frames represent real boundaries only. Do not frame every layer or category automatically.

## 2. module-architecture

Primary question: **How is one module composed internally, and how do its blocks, interfaces, state, and responsibilities relate?**

Typical content:

- internal components and blocks
- provided and required interfaces
- control relationships and data relationships
- shared state, caches, buffers, queues, and adapters
- ports exposed to external modules
- ownership of subcomponents

Preferred views:

- `component-view`: responsibilities and dependencies
- `internal-block`: blocks and data/control flow
- `port-interface-view`: external ports and provided/required interfaces

A module boundary may be visible because it is the subject of the diagram. Internal blocks should not each receive their own frame.

## 3. flow

Primary question: **How does a request, event, control signal, or data item move through the system?**

Existing subtypes:

- `service-flow`: synchronous requests, dependencies, and backend interactions
- `event-flow`: async events, queues, topics, producers, and consumers
- `data-flow`: transformations, buffers, storage, and pipelines

Preferred views:

- `layered-flow`
- `swimlane-flow`
- `hub-and-spoke`

Use one obvious primary flow when a main story exists. Supporting storage, risk checks, retry paths, and background processing should not visually compete with it.

## 4. sequence

Primary question: **In what time order do actors, processes, threads, or modules exchange messages?**

Typical content:

- participants and lifelines
- synchronous calls and returns
- asynchronous messages and callbacks
- activation periods
- alternatives, optional paths, loops, timeouts, and retries
- error paths

Preferred views:

- `synchronous-sequence`
- `asynchronous-sequence`
- `initialization-sequence`

Sequence diagrams use a horizontal participant axis and a vertical time axis. They must not be rendered with the general flow-layout engine.

## Family selection rules

Use `system-architecture` when location, layering, deployment, or the whole environment is the main question.

Use `module-architecture` when the internal composition of one module is the main question.

Use `flow` when movement of data, events, control, or requests is the main question.

Use `sequence` when ordering in time is the main question.

The same system may need more than one diagram. Do not overload one scene to answer all four questions.

## Shared semantic relations

Common relation kinds include:

- `calls`
- `returns`
- `depends-on`
- `references`
- `contains`
- `publishes`
- `subscribes`
- `reads`
- `writes`
- `transfers`
- `interrupts`
- `controls`

A diagram-type renderer decides how those semantic relations are displayed.

## Implementation rule

Shared infrastructure may own:

- semantic ids
- style tokens
- text fitting
- Excalidraw serialization
- validation
- structural quality reporting

Each diagram family should own its layout grammar. Do not force sequence, module, and layered-system views through service-flow layout rules.
