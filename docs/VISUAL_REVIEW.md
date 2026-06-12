# Visual Review Checklist

Use this checklist when reviewing generated `.excalidraw` diagrams.

## Readability

- Main flow is visible within three seconds.
- Labels are short and readable at normal zoom.
- The diagram still reads at 80 percent zoom.
- Related nodes are grouped without crowding.

## Consistency

- Similar shapeRefs produce similar visuals.
- Services, databases, queues, external systems, and risk/security nodes are visually distinct.
- Colors are role-based, not decorative.
- Strong colors are limited to important semantic roles.

## Layout

- Primary flow direction is obvious.
- Data stores do not block the main flow.
- Edges avoid crossing through important nodes when possible.
- Edge labels do not overlap nodes or other labels.
- Frames are subtle and leave enough padding.

## Professional quality

- The result looks appropriate for design review or architecture discussion.
- The diagram avoids icon overload.
- The diagram does not depend on external shape libraries.
- The output remains easy to edit manually in Excalidraw.

## Release gate

A diagram can be used as a fixture only after it opens correctly, passes validation, and satisfies the checks above well enough for a first release.
