# Frame Group Usage

Frame support is currently implemented as a postprocessor.

Use a DiagramSpec with `node.group` values.

```txt
node ./bin/excalidraw-skill.mjs render examples/service-flow/payment-flow.grouped.diagram.json
node ./src/frame-groups.mjs examples/service-flow/payment-flow.grouped.excalidraw examples/service-flow/payment-flow.grouped.diagram.json
node ./bin/excalidraw-skill.mjs label-edges examples/service-flow/payment-flow.grouped.excalidraw
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.grouped.excalidraw
```

The main CLI dispatcher does not expose `frame-groups` yet because the direct bin update was blocked. The standalone runner is available.
