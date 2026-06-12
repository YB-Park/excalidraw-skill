# Professional Software Style

Use this style for v0.2 software diagrams.

## Principles

- Use color for role, not decoration.
- Keep strong colors limited to the main flow and important semantic roles.
- Prefer readable labels over dense detail.
- Use subtle frames for boundaries.
- Preserve manual layout on edits.

## Role colors

- Client and actor: neutral slate.
- Gateway and public API edge: blue.
- Core services: indigo.
- Data stores: teal.
- Cache: green.
- Queue and async event flow: purple.
- External system: gray.
- Risk, security, fraud, or warning: amber or red accent.
- Frames and boundaries: light neutral background.

## Shape rules

- Services use rounded rectangles.
- Databases use a distinct data-store component.
- Queues and topics use a distinct async component.
- External systems use muted styling or dashed borders.
- Sequence diagrams use lifelines and message arrows.
- State and process diagrams use compact labeled nodes.

## LLM rules

- Do not choose raw hex colors.
- Set `stylePreset` to `professional-software`.
- Choose `shapeRef` from the catalog.
- Let the renderer map roles to visual styles.
