# Visual Plan

`Visual Plan` is the compact v0.3 contract for expressing layout intent without raw coordinates.

The LLM chooses semantic relationships and high-level visual structure. The local renderer chooses exact positions, routes, label offsets, frames, and Excalidraw element details.

## Top-level layout

Use a `layout` object only when it materially improves readability.

Supported initial fields:

- `profile`: `layered-flow`, `hub-and-spoke`, or `swimlane-flow`
- `direction`: `left-to-right` or `top-to-bottom`
- `aspectRatio`: `balanced`, `wide`, or `tall`
- `primaryFlow`: ordered semantic ids for the main reading path
- `lanes`: named layout lanes

Lanes are invisible layout constructs by default. Declaring a lane does not request a visible frame, panel, or region.

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

A node-level `group` is also a logical grouping hint. It does not automatically mean that a visible frame should be drawn.

Example:

```json
{
  "semanticId": "payment-db",
  "label": "Payment DB",
  "shapeRef": "database.relational",
  "group": "payments",
  "layoutHints": {
    "lane": "support",
    "rank": 3,
    "importance": "secondary",
    "keepNear": ["payment-service"]
  }
}
```

## Visible boundaries

Use a visible frame only when it communicates a real boundary such as:

- trust or security boundary
- ownership boundary
- deployment boundary
- external versus internal boundary
- a substantial subsystem containing several nodes

Declare those boundaries explicitly with `groups`:

```json
{
  "groups": [
    {
      "id": "external-systems",
      "label": "External Systems",
      "visualBoundary": true
    }
  ],
  "nodes": [
    {
      "semanticId": "card-network",
      "label": "Card Network",
      "shapeRef": "external.provider",
      "group": "external-systems"
    },
    {
      "semanticId": "fraud-provider",
      "label": "Fraud Provider",
      "shapeRef": "external.provider",
      "group": "external-systems"
    }
  ]
}
```

Rules:

- Prefer zero or one visible boundary in a small diagram.
- Use at most two visible boundaries unless the user explicitly requests more.
- Do not frame a single database, queue, topic, worker, service, or provider.
- Do not create one frame per concern, lane, or node type.
- Do not frame the whole diagram when the frame adds no information.
- Prefer whitespace and placement over boxes.
- When `groups` is present, only entries with `visualBoundary: true` should become visible frames.

Optional `framePolicy` fields exist for exceptional cases:

- `mode`: `none` or `explicit`
- `maxFrames`: maximum visible frames
- `include`: group ids allowed to render
- `exclude`: group ids that must not render
- `minMembers`: minimum nodes required in a frame

Do not emit `framePolicy` unless the user specifically asks for stronger frame control.

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
- Treat lanes and logical groups as invisible unless a real boundary must be shown.
- Do not use route hints to micromanage every edge.

## Renderer responsibilities

The renderer may normalize or ignore contradictory hints. It suppresses tiny, redundant, whole-scene, or excessive automatic frames. Exact placement, routing, and frame selection remain deterministic implementation details.
