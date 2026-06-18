# module-architecture

Use this family when the diagram must explain the internal composition of one module.

## Questions this diagram answers

- Which internal blocks exist?
- Which block owns each responsibility?
- Which interfaces are provided or required?
- Where do control, data, and shared state flow?
- Which external modules connect through which ports?

## Views

### component-view

Use for responsibilities and static dependencies.

- emphasize ownership and dependency
- keep implementation details below the level needed for review
- distinguish public interfaces from internal helpers

### internal-block

Use for blocks, data paths, control paths, queues, buffers, and state.

- place the module boundary around all internal blocks
- keep external collaborators outside the module boundary
- use separate relation kinds for data and control
- place shared state near its actual users

### port-interface-view

Use when external interfaces are the main story.

- expose provided and required ports
- place ports on the module boundary
- connect external modules to ports, not directly to arbitrary internal blocks
- label direction and responsibility clearly

## Recommended semantic fields

Top-level `module` may contain:

- `focusModule`
- `boundaryLabel`
- `externalPorts`

Node fields may include:

- `responsibility`
- `visibility`: `public`, `internal`, or `private`
- `componentRole`: `controller`, `worker`, `adapter`, `repository`, `buffer`, `state`, or `utility`

Relations should use explicit kinds such as:

- `calls`
- `depends-on`
- `controls`
- `reads`
- `writes`
- `publishes`
- `subscribes`
- `transfers`
- `references`

## Visual rules

- show one module boundary by default
- do not put each internal block in its own frame
- external modules must remain outside the focus-module boundary
- provided and required interfaces must be visually distinguishable
- shared state must not appear to belong to a block that only reads it
- data paths and control paths should use consistent relation styles
- prefer a small number of responsibility-based blocks over class-level detail

## Good default

Start with `component-view`. Move to `internal-block` when data/control movement matters, and use `port-interface-view` only when interface contracts are the review focus.