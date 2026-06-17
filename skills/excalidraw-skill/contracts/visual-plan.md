# Visual Plan

`Visual Plan` is the compact v0.3 contract for expressing layout intent without raw coordinates.

The LLM chooses semantic relationships and high-level visual structure. The local renderer chooses exact positions, routes, label offsets, and Excalidraw element details.

## Top-level layout

Use a `layout` object only when it materially improves readability.

Supported initial fields:

- `profile`: `layered-flow`, `hub-and-spoke`, or `swimlane-flow`
- `direction`: `left-to-right` or `top-to-bottom`
- `aspectRatio`: `balanced`, `wide`, or `tall`
- `primaryFlow`: ordered semantic ids for the main reading path
- `lanes`: named visual lanes

Example:

```json
{
  "layout": {
    "profile": "layered-flow",
    "direction": "left-to-right",
    "aspectRatio": "balanced",
    "primaryFlow": [
      "web-app",
      "api-gateway",
      "payment-service",
      "card-network"
    ],
    "lanes": [
      {"id": "main", "position": "center", "order": 1},
      {"id": "support", "position": "below", "order": 2}
    ]
  }
}
```

## Node layout hints

Optional `layoutHints` fields:

- `lane`: references a lane id
- `rank`: relative order inside the layout direction
- `importance`: `primary`, `secondary`, or `support`
- `keepNear`: semantic ids that should remain nearby
- `keepApart`: semantic ids that should not share the same local area

Example:

```json
{
  "semanticId": "payment-db",
  "label": "Payment DB",
  "shapeRef": "database.relational",
  "layoutHints": {
    "lane": "support",
    "rank": 3,
    "importance": "secondary",
    "keepNear": ["payment-service"]
  }
}
```

## Edge route hints

Optional `routeHints` fields:

- `direction`: `auto`, `right`, `left`, `up`, or `down`
- `priority`: `primary` or `secondary`
- `labelSide`: `auto`, `above`, `below`, `left`, or `right`

Example:

```json
{
  "semanticId": "payment-to-db",
  "from": "payment-service",
  "to": "payment-db",
  "label": "persist",
  "kind": "sync",
  "routeHints": {
    "direction": "down",
    "priority": "secondary",
    "labelSide": "right"
  }
}
```

## Rules for LLMs

- Do not write raw x/y coordinates.
- Keep `primaryFlow` short and ordered.
- Every semantic id referenced by layout hints must exist.
- Every node lane must reference a declared lane.
- Use hints only when they communicate real visual intent.
- Prefer one obvious primary flow and move supporting concerns to separate lanes.
- Do not use route hints to micromanage every edge.

## Renderer responsibilities

The renderer may normalize or ignore contradictory hints. Exact placement and routing remain deterministic implementation details.
