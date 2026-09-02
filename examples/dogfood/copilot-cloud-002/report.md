# Copilot cloud dogfood 002 — LayoutState interaction

## Result

This run is useful negative evidence rather than a passing acceptance run.

The baseline scene was generated and a simulated human art-direction edit moved two existing semantic nodes. The captured LayoutState records `payment-service` at `(680, 190)` and `payment-events` at `(1060, 545)`. After a semantic edit introduced `fraud-review-worker`, LayoutState reapply moved those same existing nodes by `(-40, -50)` and `(40, 34)` respectively, restoring the captured positions.

The regenerated scene preserved editability: 9 nodes, 8 edges, no missing/unbound labels, no invalid edge bindings, and no missing label backrefs. The new semantic node `fraud-review-worker` and edge `fraud-check-to-review-worker` are present.

However, the fresh deterministic quality review fails. It reports 7 endpoint-approach violations, 1 endpoint-node penetration (`events-to-worker` at `payment-events`), 1 edge-label/node overlap, and 1 center-axis violation caused by the manually preserved `payment-service` position. Therefore `hardGatesPassed` and `routingAcceptable` are false. This exposes the known architectural gap: LayoutState restores node/label placement but does not reconcile arbitrary edge routing after the move.

`regenerated.review.json` confirms a valid PNG was produced but explicitly says `requiresVisualReview: true` and `visualApprovalPerformed: false`. The cloud-agent run did not leave trustworthy evidence that the actual final PNG pixels were inspected, so `visualInspectionPerformed` is false. No visual approval is inferred from deterministic artifacts.

## Evidence

- Captured `payment-service`: `(680, 190)`; reapply delta from regenerated layout: `(-40, -50)`.
- Captured `payment-events`: `(1060, 545)`; reapply delta: `(40, 34)`.
- Final inspection reports those restored coordinates and includes the new `fraud-review-worker` semantic node.
- Editability passes with zero unbound labels and zero invalid bindings.
- Deterministic quality fails, including routing defects and a center-axis violation.

## Conclusion

Layout preservation works for the exercised semantic nodes and their bound labels, and the semantic edit remains structurally editable. The interaction workflow is not yet safe to promote because routing reconciliation is missing and the preserved human placement can conflict with a deterministic family invariant. A future repair should distinguish intentional human axis deviation from accidental drift and reroute affected edges after LayoutState application, followed by a mandatory fresh review.
