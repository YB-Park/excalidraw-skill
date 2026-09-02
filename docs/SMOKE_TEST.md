# Smoke Test

Run this when validating the repository checkout before sharing a runtime change or starting a dogfood session.

## Repository smoke

```text
npm run doctor
npm run init
npm run smoke
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs editability-report examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs quality-report examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
```

`npm run smoke` builds `examples/service-flow/payment-flow.visual-plan.diagram.json`, whose output path is:

```text
examples/service-flow/payment-flow.visual-plan.excalidraw
```

All follow-up checks must target that exact generated scene. Do not validate a different committed example as a substitute.

## Expected result

- `doctor` prints a healthy local runtime and Node version.
- `init` checks/creates project-local entrypoints.
- `smoke` creates or updates `payment-flow.visual-plan.excalidraw`.
- `inspect` prints semantic node/edge summaries.
- `editability-report` passes native text/arrow/frame/group checks.
- `validate` returns ok.
- `quality-report` passes structural/family checks for the smoke spec.

## Broader developer regression

For a runtime or layout change, the smoke scene alone is not enough. Also run:

```text
npm test
npm run smoke:system
npm run smoke:module
npm run evaluate:strict
```

CI additionally checks actual Excalidraw render signatures and accepted patch round trips.

## Installed-runtime smoke

After global installation, also test from an unrelated writable workspace. The managed runtime must create/project-local artifacts in that workspace rather than depending on the repository as its current directory.

See `docs/AGENT_SETUP.md` for the clean-workspace procedure.
