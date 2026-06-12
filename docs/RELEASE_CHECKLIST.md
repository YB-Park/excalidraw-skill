# Release Checklist

Use this checklist before sharing or publishing a new version.

## Package metadata

- `package.json` has the intended version.
- `bin/excalidraw-skill.mjs` is listed as the package binary.
- `files` includes `bin`, `src`, `skills`, entrypoints, docs, and examples.
- Node.js and npm engine requirements are present.

## Smoke test

- Run `npm run doctor`.
- Run `npm run init`.
- Run `npm run smoke`.
- Inspect the generated scene.
- Validate the generated scene.

## Agent entrypoints

- `.opencode/commands/excalidraw.md` exists.
- `.github/prompts/excalidraw.prompt.md` exists.
- `skills/excalidraw-skill/SKILL.md` exists.

## Known scope for this release

- Layout tuning is intentionally iterative.
- Generated `.excalidraw` examples may be committed after visual review.
- Global installation is not part of the first release.

## Ready to share when

- The smoke test passes locally.
- The generated file opens in Excalidraw or the VS Code Excalidraw extension.
- A teammate can run `init` and `build` from a clean clone.
