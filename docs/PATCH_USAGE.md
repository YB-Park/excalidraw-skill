# Patch Usage

Patch support is available through the main CLI dispatcher.

```txt
excalidraw-skill patch examples/service-flow/payment-flow.excalidraw examples/service-flow/add-fraud-check.patch.json
```

The current patch runner supports:

- addNode
- addEdge
- updateLabel

This is still a smoke-test implementation.
