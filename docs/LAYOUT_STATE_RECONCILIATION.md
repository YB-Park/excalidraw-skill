# LayoutState reconciliation

`LayoutState` is human-authored presentation state layered over a regenerated semantic scene. Applying it is not a plain coordinate copy.

When a locked semantic node is restored to a captured position, the runtime now:

1. moves the semantic node and its native bound text together;
2. marks the node with `manualLayout: true` and `manualLayoutSource: "layout-state"`;
3. finds semantic edges connected to moved nodes;
4. preserves each endpoint's boundary side and approximate port fraction when possible;
5. rebuilds a short orthogonal route between the new endpoint positions;
6. shifts the associated edge label with the route midpoint delta;
7. records reconciliation evidence and requires a fresh review.

The reconciliation is intentionally local. It does not claim global layout optimization, aesthetic approval, or safe resolution of every obstacle. A fresh deterministic review remains mandatory after application.

Manual layout provenance is evidence of human placement intent. In `swimlane-flow`, a node marked with both `manualLayout: true` and `manualLayoutSource: "layout-state"` is exempt from the ideal center-axis presentation check. It must not be confused with semantic authority: primary-flow ordering, bindings, editability, node overlap, and route-integrity checks remain hard constraints.
