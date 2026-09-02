# Render Quality Pipeline

Normal generation should use the single `build` entry point. Do not reproduce the production pipeline by manually chaining low-level postprocessors.

## Recommended flow

```text
node ./bin/excalidraw-skill.mjs build examples/service-flow/payment-flow.visual-plan.diagram.json
node ./bin/excalidraw-skill.mjs inspect examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs editability-report examples/service-flow/payment-flow.visual-plan.excalidraw
node ./bin/excalidraw-skill.mjs quality-report examples/service-flow/payment-flow.visual-plan.excalidraw examples/service-flow/payment-flow.visual-plan.diagram.json
```

`build` owns the exact production ordering. Low-level commands are developer/debug tools and may change as the quality pipeline evolves.

## Current quality layers

The production build includes, at a high level:

1. semantic rendering from DiagramSpec
2. style preset application and text sizing
3. family-specific layout/refinement
4. orthogonal edge routing and route portfolio optimization
5. fan-out/fan-in, support-route, module-route, and endpoint repair where applicable
6. route-integrity hard gate
7. native grouping/frame membership
8. edge label generation and collision-aware placement
9. font/style finalization
10. native editability report
11. basic file validation
12. structural/family quality report
13. perceptual quality report

The exact implementation sequence lives in `src/build.mjs`; user-facing guides should refer to `build` rather than copying its internal steps.

## Hard vs soft quality

Hard blockers include semantic corruption, native editability failures, invalid endpoint geometry, edge-through-node defects, and structural/family invariant failures.

Perceptual metrics cover readability costs such as bends, route detours, crossing geometry, label association, and composition. CI protects the accepted corpus with strict readability budgets and actual Excalidraw render signatures.

A hard-gate pass is not permission to ignore a visibly poor result. During dogfood, visual defects should be preserved as reproducible cases, fixed in geometry/layout code, and added to the corpus rather than hidden by loosening gates.

## Existing-scene edits

Patch uses a separate local-edit pipeline. It preserves manual layout by default, reroutes only affected relationships as needed, and runs native editability plus structural quality gates before returning success.

See `docs/PATCH_USAGE.md`.
