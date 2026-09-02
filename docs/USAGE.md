# Usage

This guide covers normal use of `excalidraw-skill`: create a new editable Excalidraw scene, review it, and make small semantic edits later.

## Recommended mode: use the installed skill from Copilot

Install globally first with `docs/GLOBAL_INSTALL.md`, then reload VS Code or start a new Copilot Chat.

From the project where you want the diagram, ask naturally and include an output path when possible:

```text
이 프로젝트의 결제 승인 흐름을 Excalidraw로 그려줘.
excalidraw-skill을 사용하고 diagrams/payment-approval.excalidraw에 저장해줘.
```

For architecture:

```text
이 시스템의 middleware layer 구조를 한 장으로 보여줘.
layered system architecture로 만들고 diagrams/middleware.excalidraw에 저장해줘.
```

For a module internals view:

```text
Connection Manager 내부 책임과 collaborator를 component view로 정리해줘.
diagrams/connection-manager.excalidraw에 저장해줘.
```

The agent should choose the supported family/profile, write a compact spec in the workspace, run `build`, inspect the result, and report the generated path plus quality status.

## What a successful creation produces

The primary artifact is the requested `.excalidraw` file. The build pipeline also produces reports beside it, including native editability and quality information.

A normal generated scene should have:

- editable node text using native Excalidraw container binding
- arrows bound to source/target nodes
- semantic ids that can be inspected and patched later
- structural quality checks completed before success is reported

Passing automated quality is evidence of structural safety, not a substitute for visual review. During dogfood, open important outputs in Excalidraw or the VS Code Excalidraw extension and look at them.

## Edit an existing diagram

Refer to the existing `.excalidraw` path explicitly:

```text
diagrams/payment-approval.excalidraw을 수정해줘.
Payment Service를 Payment Authorization Service로 바꾸고
나머지 수동 배치는 최대한 유지해줘.
```

Or request a structural local edit:

```text
diagrams/payment-approval.excalidraw에서 Settlement Worker를 제거해줘.
연결된 edge도 정리하되 unrelated node는 움직이지 마.
```

The intended edit flow is:

```text
inspect existing scene
→ create DiagramPatch from semantic ids
→ patch
→ editability / validation / structural quality checks
```

`patch` is edit-only. It is not a generation shortcut for a new diagram.

Supported semantic patch operations are documented in `docs/PATCH_USAGE.md`.

## Currently renderable scope

### Flow families

- `flow`
- `service-flow`
- `event-flow`
- `data-flow`

Runnable profiles include:

- `layered-flow`
- `swimlane-flow`
- `hub-and-spoke`

### System architecture

Runnable now:

- `system-architecture` / `layered-system`

Contract-only for now:

- `deployment-view`
- `context-view`

### Module architecture

Runnable now:

- `module-architecture` / `component-view`

Contract-only for now:

- `internal-block`
- `port-interface-view`

### Sequence

The dedicated sequence renderer is not implemented yet. Do not route sequence requests through the graph/flow renderer. An agent may draft `SequenceSpec`, but rendered `.excalidraw` sequence output is not currently part of normal dogfood scope.

## Direct CLI use from the repository checkout

New diagram:

```text
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.visual-plan.diagram.json
```

Inspect the exact output created by that spec:

```text
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.visual-plan.excalidraw
```

Run reports explicitly when needed:

```text
node ./bin/excalidraw-skill.mjs editability-report examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs quality-report examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
```

For existing-scene edits:

```text
node ./bin/excalidraw-skill.mjs inspect <scene.excalidraw>
node ./bin/excalidraw-skill.mjs patch <scene.excalidraw> <patch.json> -o <updated.excalidraw>
node ./bin/excalidraw-skill.mjs editability-report <updated.excalidraw>
node ./bin/excalidraw-skill.mjs validate <updated.excalidraw>
node ./bin/excalidraw-skill.mjs quality-report <updated.excalidraw>
```

For new diagrams, `build` is the normal entry point. Do not call low-level `render` directly unless debugging the renderer pipeline.

## Project-local prompt entrypoints

If you do not want global installation:

```text
npm install
npm run doctor
npm run init
```

This creates prompt entrypoints in the current workspace:

```text
.opencode/commands/excalidraw.md
.github/prompts/excalidraw.prompt.md
```

It does not install the managed runtime into `~/.copilot`.

## Opening the result in VS Code

Recommended extension:

```text
Extension name: Excalidraw
Extension id: pomdtr.excalidraw-editor
```

When the VS Code CLI is available:

```text
code --install-extension pomdtr.excalidraw-editor
```

## Troubleshooting

If the global skill is not discovered:

1. Run `npm run skill:doctor:global` from the excalidraw-skill checkout.
2. Confirm `ok`, `skillOk`, and `runtimeOk` are true.
3. Reload VS Code or start a new Copilot Chat.
4. Ask the agent to use the available `excalidraw-skill` explicitly once.

If generation fails a quality/editability gate, do not bypass the gate. Keep the failure output and refine the spec or local patch.

If a generated scene looks bad despite passing hard gates, treat that as a dogfood defect: preserve the scene/spec, reproduce it, and add it to the quality corpus before changing baselines.

## Agent-assisted installation

To have an LLM agent configure the repository/machine, ask it to follow:

```text
Read docs/AGENT_SETUP.md and set this up globally.
```
