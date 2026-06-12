# Smoke Test

Run this before sharing or publishing the package.

## Commands

```txt
npm run doctor
npm run init
npm run smoke
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.grouped.excalidraw
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.grouped.excalidraw
```

## Expected result

- `doctor` prints the current Node.js version.
- `init` reports checked and created entrypoints.
- `smoke` creates or updates the grouped payment flow scene.
- `inspect` prints node and edge summaries.
- `validate` returns ok.

## Notes

The generated `.excalidraw` output is editable and may be committed later as a fixture after visual review.
