# Architecture Overview

The project uses a thin router skill, small on-demand guides, compact contracts, and a local CLI.

## Principles

1. One top-level skill is exposed to the agent.
2. The top-level skill routes to small task guides.
3. The agent reads only the files needed for the current task.
4. Diagram generation uses `DiagramSpec`.
5. Existing diagram edits use `SceneSummary` and `DiagramPatch`.
6. Visual consistency comes from style presets and the renderer, not free-form model choices.
7. Custom shapes are selected through a small catalog, not by reading raw library files.

## Runtime flow

```txt
/excalidraw request
  -> prompt or command entrypoint
  -> excalidraw-skill router
  -> task guide
  -> DiagramSpec or DiagramPatch
  -> local CLI
  -> editable Excalidraw scene
```

## Why this structure

A single huge prompt is easy to start with but expensive and hard to maintain.

A large set of unrelated top-level skills creates discovery noise.

The recommended middle ground is one router skill with focused guide files.
