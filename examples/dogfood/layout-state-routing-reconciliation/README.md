# LayoutState routing reconciliation checkpoint

This directory is reserved for the focused rerun of the LayoutState dogfood scenario after the routing-reconciliation change.

Acceptance target:

- existing semantic nodes restore captured positions;
- bound labels remain attached;
- affected semantic edges terminate on the moved node boundaries rather than stale coordinates;
- affected routes retain orthogonal endpoint approach;
- edge labels remain associated with their routes;
- semantic edits remain editable;
- a fresh deterministic review is required after reapply;
- no visual approval is inferred from PNG existence alone.

The earlier negative evidence remains in `examples/dogfood/copilot-cloud-002/` and must not be rewritten or baseline-refreshed away.
