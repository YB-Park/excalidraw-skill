# Global Installation

Use this mode when the skill should be available from any workspace on the same machine.

## Install

From a checkout of this repository:

```text
npm install
npm test
npm install -g .
excalidraw-skill install --global
excalidraw-skill doctor --global
```

The managed skill bundle is installed to:

```text
~/.copilot/skills/excalidraw-skill
```

On Windows, `~` resolves to the current user's home directory.

The installer copies the complete self-contained bundle, including guides, contracts, diagram-family rules, shape catalog, and quality criteria.

## Update

After pulling a newer version of the repository:

```text
npm install -g .
excalidraw-skill install --global
excalidraw-skill doctor --global
```

A managed installation is replaced atomically. Files left over from older versions are removed.

## Safety

The installer writes a management marker inside the target directory.

If the target directory already exists without that marker, installation stops instead of overwriting user files. Replace it only when intentional:

```text
excalidraw-skill install --global --force
```

## Uninstall

```text
excalidraw-skill uninstall --global
```

Unmanaged directories are not removed unless `--force` is supplied.

## Custom locations

The default target can be changed for testing or nonstandard environments:

```text
EXCALIDRAW_SKILL_GLOBAL_DIR=/custom/path excalidraw-skill install --global
```

Or set a custom Copilot home:

```text
COPILOT_HOME=/custom/copilot-home excalidraw-skill install --global
```

## Project-local setup

Project-local setup remains available:

```text
npm install
npm run init
```

This creates project entrypoints such as `.opencode/commands/excalidraw.md` and `.github/prompts/excalidraw.prompt.md`. It does not install anything into `~/.copilot/skills`.

## After installation

Start a new Copilot chat or reload VS Code so the global skill directory is scanned again.
