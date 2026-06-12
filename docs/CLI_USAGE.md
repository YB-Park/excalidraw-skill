# CLI Usage

The CLI is intentionally small at this stage.

## Commands

```txt
excalidraw-skill doctor
excalidraw-skill list-shapes
excalidraw-skill render examples/service-flow/payment-flow.diagram.json
excalidraw-skill inspect examples/service-flow/payment-flow.excalidraw
excalidraw-skill validate examples/service-flow/payment-flow.excalidraw
```

## Current status

- `render` creates a minimal editable Excalidraw scene from a DiagramSpec.
- `inspect` prints a compact scene summary.
- `validate` checks the basic Excalidraw scene shape.
- `patch` is still planned.

This is a smoke-test layer, not the final renderer.
