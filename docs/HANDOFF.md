# Handoff

## Current phase
Cognitive-agent contained dogfood / pre-release. The project is validating a mixed-initiative quality architecture on the existing supported families. Do **not** expand sequence/deployment/context yet.

The architectural principle is:

> The kernel prevents invalid diagrams. The agent explores understandable diagrams. The human owns final visual intent.

Work through normal PR/CI discipline for architecture changes. Do not lower existing kernel quality gates to make the cognitive layer pass.

Latest verified `main` before this branch: `a28448b3b0f321f65f48b86c122123c8b4c9c26c`.

## Supported surface
Renderable now:
- flow / service-flow / event-flow / data-flow: `layered-flow`, `swimlane-flow`, `hub-and-spoke`
- system-architecture: `layered-system`
- module-architecture: `component-view`

Not renderable yet: sequence, deployment/context views, internal-block/port-interface views. Do not silently fall back to another family.

`stylePreset` is optional. Omit it by default; runtime default is `professional-software`. If explicit, use only `professional-software`. Do not use or add a `default-software` alias.

## Quality architecture
Quality is intentionally split into three layers.

### Deterministic kernel
Authoritative for crisp correctness conditions: semantic references, native editability, binding/endpoint integrity, frame containment, invalid overlaps, label fit, unsupported-family behavior, routing integrity, and unrelated manual-layout preservation.

A recurring **structural** failure becomes a deterministic invariant/test/repair.

### Cognitive design layer
Responsible for global composition, storytelling, perceived hierarchy, centrality, whitespace, support-path prominence, and task comprehension. These are perceptual judgments, not hard scalar truths.

`readabilityCost` and similar metrics remain useful regression/suspicion signals but must not be treated as a definition of visual quality or as the sole candidate selector.

A recurring **perceptual** preference becomes preference evidence, a candidate strategy, or a human correction pattern. Do not automatically turn it into another hard rule.

### Human art direction
Manual layout is product input, not automation failure. Stable semantic IDs allow presentation decisions to be captured separately as `LayoutState` and reapplied without baking coordinates into semantic DiagramSpec data.

The current LayoutState slice proves semantic-ID keyed node/label position capture and reapplication. It does **not** yet claim full arbitrary-human-move edge rerouting; fresh review is required after reapplication.

## Cognitive candidate workflow
For an important new diagram in the current VS Code dogfood workspace:
1. Plan semantics and reader intent without x/y coordinates.
2. Build the three deterministic strategies through `diagram_candidates`:
   - `narrative`: primary story continuity;
   - `compact`: lower eye travel/spread;
   - `structured`: conceptual-center/relationship exploration; flow dogfood currently uses `hub-and-spoke`.
3. Every candidate must pass the existing deterministic build/review gates.
4. CI rejects a candidate portfolio with a near-duplicate composition. Diversity is an exploration prerequisite, **not** an aesthetic score.
5. The Critic independently inspects the actual PNG for each candidate using five dimensions: narrative clarity, semantic hierarchy, spatial coherence, visual economy, and task comprehension.
6. Treat the Critic as a noisy preference sensor. Low confidence, close candidates, or presentation-critical work escalates to the human.
7. Human selection/correction becomes preference evidence; do not fabricate human rankings.

For an existing diagram:
1. Inspect first.
2. Preserve stable semantic IDs and existing human presentation intent.
3. Capture LayoutState before semantic regeneration when the human has manually arranged nodes.
4. Apply the smallest semantic patch or regeneration required.
5. Reapply locked LayoutState where appropriate.
6. Run deterministic review and inspect a fresh image before approval.

## VS Code / MCP dogfood surface
Repository-native dogfood currently provides:
- `.github/agents/excalidraw-designer.agent.md` — user-facing coordinator;
- `.github/agents/excalidraw-planner.agent.md` — read-only semantic subagent;
- `.github/agents/excalidraw-critic.agent.md` — multimodal perceptual subagent;
- `.mcp.json` + `mcp/server.mjs` — typed semantic tools.

Initial MCP tools:
- `diagram_candidates`
- `diagram_review_image`
- `diagram_validate`
- `diagram_capture_layout_state`
- `diagram_apply_layout_state`

`diagram_review_image` returns the actual PNG as MCP image content plus deterministic review evidence. No agent may claim visual approval from metrics alone.

This agent/MCP layer is currently **repo/workspace-native dogfood integration**. General distribution into arbitrary initialized projects is not yet claimed complete.

## Cheap-model policy
All Excalidraw custom agents explicitly restrict themselves to the current low-cost allow-list:
- GPT-5.6 Luna
- MAI-Code-1.1-Flash
- Kimi K2.7 Code

Designer and Planner prefer Luna. Critic currently prefers MAI-Code-1.1-Flash for image-capable review. Model names are configuration, not architecture; replacements must remain cheap-tier and satisfy the role capability. No agent may silently escalate or hand off to a more expensive model.

## Verified baseline on this branch
Current branch CI vertical slice has demonstrated:
- all unit tests and existing smoke builds pass;
- the real payment-flow candidate portfolio builds three valid candidates and verified PNGs;
- the candidate diversity gate passes with a compositionally distinct `structured` candidate;
- strict evaluation remains green;
- existing layout research remains green;
- Chromium/native patch round trips and actual-render signatures remain green;
- all runnable actual Excalidraw render signatures remain green.

Manual artifact inspection also proved why the separation matters: the `structured` candidate is genuinely different, but its reading path is weaker than the Narrative/Compact candidates. This is acceptable exploration evidence and should be rejected by critic/human preference rather than encoded as a new deterministic failure rule.

## Evaluation suites
1. **Kernel Contract Suite** — deterministic correctness and existing native-render regressions.
2. **Cognitive Preference Suite** — human-ranked real tasks measured by top-1 agreement, pairwise agreement, repeat/order stability, confidence, and human-escalation rate.
3. **Interaction Suite** — human presentation state survives later semantic changes and routing/review remain sound.

The preference corpus is intentionally empty until a person actually inspects candidate images and records a ranking. Never invent human preference data to make the suite look populated.

## Immediate next work
1. Finish this cognitive-agent vertical slice through PR merge and verify `main` CI.
2. Dogfood the VS Code `Excalidraw Designer` on real supported-family tasks using cheap models only.
3. Collect the first real human candidate rankings/reasons in `examples/evaluation/preference-corpus.json`; start with 10–20 meaningful tasks rather than synthetic aesthetic fixtures.
4. Measure Critic agreement/stability and escalation instead of assuming one LLM judgment is ground truth.
5. Exercise a real human manual-layout edit, capture LayoutState, make a semantic change, then prove routing reconciliation + fresh review before declaring the full Interaction Suite complete.
6. Decide agent/MCP installation/distribution only after repo-native dogfood shows the workflow is worth carrying into external workspaces.
7. Only consider broader family support after the current families survive this mixed-initiative dogfood cleanly.

## Non-negotiables
- Do not lower kernel thresholds or refresh baselines just to green CI.
- Do not accept a diagram on metrics alone.
- Do not treat candidate diversity as candidate quality.
- Do not treat one LLM judge call as perceptual ground truth.
- Do not fabricate human preference evidence.
- Preserve semantics, native editability, and unrelated human layout as hard constraints.
- Keep this file as a live snapshot: replace stale state instead of appending history.
