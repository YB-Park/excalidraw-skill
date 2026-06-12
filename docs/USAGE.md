# Usage

This is the user-facing guide for the Excalidraw skill package.

## Agent setup

Ask an LLM agent to run:

```txt
Read docs/AGENT_SETUP.md and set this up.
```

The agent should verify Node.js, npm, Git, run setup commands, install the VS Code Excalidraw extension when possible, and run the smoke test.

## Manual setup

```txt
npm install
npm run doctor
npm run init
npm run smoke
```

## Create a diagram

Use the opencode command:

```txt
/excalidraw 결제 승인 흐름 다이어그램 만들어줘
```

Or run the CLI directly:

```txt
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.grouped.diagram.json
```

## Edit an existing diagram

The intended edit flow is:

```txt
inspect existing .excalidraw
create a DiagramPatch
apply patch
validate result
```

Example:

```txt
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.grouped.excalidraw
node ./bin/excalidraw-skill.mjs patch examples/service-flow/payment-flow.grouped.excalidraw examples/service-flow/add-fraud-check.patch.json
node ./bin/excalidraw-skill.mjs validate examples/service-flow/payment-flow.with-fraud-check.excalidraw
```

## VS Code extension

Recommended extension:

```txt
Extension name: Excalidraw
Extension id: pomdtr.excalidraw-editor
```

Install from terminal when the VS Code CLI is available:

```txt
code --install-extension pomdtr.excalidraw-editor
```

## Custom shapes

Version 0.1 uses built-in Excalidraw shapes only.

The package uses `shapeRef` values such as `service.backend`, `database.relational`, and `queue.topic` so future versions can map those semantic refs to a team Excalidraw library without changing LLM prompts.

Custom libraries should be optional, not required for the first release.
