# Human preference capture

`examples/evaluation/preference-corpus.json` is reserved for explicit human preference evidence. Assistant rankings, deterministic scores, and inferred choices must never be inserted as human evidence.

## Record one ranking

After a person has inspected the actual candidate images while candidate strategy names remain hidden, record the complete opaque-ID ranking:

```bash
npm run preference:record -- \
  --manifest examples/service-flow/payment-flow.visual-plan.candidates.json \
  --scenario payment-approval \
  --ranking c01,c02,c03 \
  --human-confirmed \
  --note "primary story was easiest to scan"
```

The command refuses to write unless:

- `--human-confirmed` is present;
- the manifest exposes at least two candidate IDs;
- every candidate is ranked exactly once;
- rankings use opaque IDs such as `c01`, `c02`, `c03` rather than strategy names.

Each accepted case records `source: "human"`, `humanConfirmed: true`, `inspectedActualImages: true`, an ISO timestamp, scenario metadata, the manifest path, the complete ranking, and an optional note.

## Collection target

The first useful corpus target is 10–20 independent human rankings across real flow-family tasks. Keep the corpus empty until real human choices are submitted. Do not backfill it from existing assistant dogfood reports.
