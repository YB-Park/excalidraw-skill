# Usage

This guide covers normal use of `excalidraw-skill`: create a new editable Excalidraw scene, verify it structurally, review it visually, and make small semantic edits later.

## Recommended mode: installed skill from Copilot

Install globally with `docs/GLOBAL_INSTALL.md`, reload VS Code or start a new Copilot Chat, then ask naturally from the target project workspace:

```text
이 프로젝트의 결제 승인 흐름을 Excalidraw로 그려줘.
excalidraw-skill을 사용하고 diagrams/payment-approval.excalidraw에 저장해줘.
완성 후 PNG preview를 실제로 보고 큰 시각적 문제가 없는지도 확인해줘.
```

The intended creation flow is:

```text
DiagramSpec / Visual Plan
→ build
→ editability + structural/perceptual quality
→ preview PNG
→ image-based visual review
→ at most two bounded refinement passes if needed
```

For new diagrams, fix visual defects by refining the spec/Visual Plan and rebuilding. Do not patch a brand-new diagram just for polish.

## What a successful creation produces

The primary artifact is the requested `.excalidraw` file. Build also produces native-editability and quality reports.

A normal generated scene should have:

- editable native node text
- arrows bound to source/target nodes
- semantic ids for later inspection/patching
- structural quality checks completed before success

Automated quality is evidence, not aesthetic approval. During dogfood, create a portable PNG preview and inspect it when image vision is available:

```text
node ./bin/excalidraw-skill.mjs preview examples/service-flow/payment-flow.visual-plan.excalidraw -o payment.preview.png
```

The preview is intended for routing, labels, hierarchy, whitespace, and composition review. CI still uses a separate native Excalidraw renderer as final pixel-regression ground truth.

## Important: `render` does not create PNGs

Low-level `render` writes Excalidraw JSON only. It accepts `.excalidraw` output paths and is not the normal generation command.

Do not do this:

```text
excalidraw-skill render spec.json -o diagram.png
```

Use `build` to create the final scene, then `preview` for PNG:

```text
excalidraw-skill build spec.json
excalidraw-skill preview diagram.excalidraw -o diagram.preview.png
```

The CLI rejects `render` output paths that are not `.excalidraw`, so it cannot create a JSON file disguised as a broken PNG.

## Edit an existing diagram

Refer to the `.excalidraw` path explicitly:

```text
diagrams/payment-approval.excalidraw을 수정해줘.
Payment Service를 Payment Authorization Service로 바꾸고
나머지 수동 배치는 최대한 유지해줘.
수정 후 PNG preview도 보고 확인해줘.
```

The edit flow is:

```text
inspect existing scene
→ DiagramPatch
→ patch
→ editability / validation / structural quality
→ preview PNG
→ visual locality review
```

If a visual problem remains, make the smallest additional semantic patch. `patch` is edit-only; it is not a new-diagram shortcut.

## Currently renderable scope

### Flow families

- `flow`
- `service-flow`
- `event-flow`
- `data-flow`
- runnable profiles: `layered-flow`, `swimlane-flow`, `hub-and-spoke`

### System architecture

- runnable: `layered-system`
- contract-only: `deployment-view`, `context-view`

### Module architecture

- runnable: `component-view`
- contract-only: `internal-block`, `port-interface-view`

### Sequence

The sequence renderer is not implemented. Do not route sequence requests through the graph/flow renderer. A `SequenceSpec` draft may be produced, but rendered sequence `.excalidraw` output is outside current dogfood scope.

## Direct CLI use from repository checkout

```text
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.visual-plan.diagram.json
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs editability-report examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs quality-report examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
node ./bin/excalidraw-skill.mjs preview examples/service-flow/payment-flow.visual-plan.excalidraw -o payment.preview.png
```

Existing-scene edit:

```text
node ./bin/excalidraw-skill.mjs inspect <scene.excalidraw>
node ./bin/excalidraw-skill.mjs patch <scene.excalidraw> <patch.json> -o <updated.excalidraw>
node ./bin/excalidraw-skill.mjs editability-report <updated.excalidraw>
node ./bin/excalidraw-skill.mjs validate <updated.excalidraw>
node ./bin/excalidraw-skill.mjs quality-report <updated.excalidraw>
node ./bin/excalidraw-skill.mjs preview <updated.excalidraw> -o <updated.preview.png>
```

## Project-local prompt entrypoints

```text
npm install
npm run doctor
npm run init
```

This creates `.opencode/commands/excalidraw.md` and `.github/prompts/excalidraw.prompt.md` in the current workspace without installing the managed runtime globally.

## Opening the result in VS Code

Recommended extension: `pomdtr.excalidraw-editor`.

## Troubleshooting

If the global skill is not discovered:

1. Run `npm run skill:doctor:global`.
2. Confirm `ok`, `skillOk`, and `runtimeOk` are true.
3. Reload VS Code or start a new Copilot Chat.
4. Ask the agent to use `excalidraw-skill` explicitly once.

If `preview` fails, run `skill:doctor:global` and reinstall from a checkout after `npm install`. The managed runtime includes the portable SVG→PNG preview dependency.

If a generated scene looks bad despite passing hard gates, preserve the scene/spec and preview image. Treat it as a dogfood defect and convert recurring failures into a metric, repair rule, or regression fixture rather than just moving baselines.

## Agent-assisted installation

```text
Read docs/AGENT_SETUP.md and set this up globally.
```
