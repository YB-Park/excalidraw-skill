# Render Quality Pipeline

Render quality is improved through small postprocessors.

## Recommended flow

```txt
node ./bin/excalidraw-skill.mjs render examples/service-flow/payment-flow.grouped.diagram.json
node ./src/style-by-kind.mjs examples/service-flow/payment-flow.grouped.excalidraw
node ./src/style-edges.mjs examples/service-flow/payment-flow.grouped.excalidraw
node ./src/frame-groups.mjs examples/service-flow/payment-flow.grouped.excalidraw examples/service-flow/payment-flow.grouped.diagram.json
node ./bin/excalidraw-skill.mjs label-edges examples/service-flow/payment-flow.grouped.excalidraw
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.grouped.excalidraw
```

## Current quality layers

- `style-by-kind`: applies node styling from shape refs.
- `style-edges`: styles optional and async edges.
- `frame-groups`: adds frames from node groups.
- `label-edges`: adds text labels for edge labels.

This keeps the core renderer small while letting visual quality improve incrementally.
