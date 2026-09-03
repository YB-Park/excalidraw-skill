# Global Installation

Use this mode when the full `excalidraw-skill` cognitive workflow should be available from arbitrary workspaces on the same machine through Copilot.

> Current distribution model: install from a checkout of this repository. The default path does not require `npm install -g`, a system-wide symlink, or administrator privileges.

## Requirements

- Node.js `20.20+`
- npm `10+`
- Git
- VS Code/Copilot with custom agents and MCP enabled

## Install

```text
npm install
npm run skill:install:global
npm run skill:doctor:global
```

The installer manages:

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
~/.copilot/agents/excalidraw-designer.agent.md
~/.copilot/agents/excalidraw-planner.agent.md
~/.copilot/agents/excalidraw-critic.agent.md
~/.copilot/mcp-config.json
```

It also registers the same stdio MCP server in the VS Code **user profile**. VS Code versions differ here, so registration is capability-driven:

1. Discover the installed VS Code CLI.
2. Inspect `code --help`.
3. If that build advertises `--add-mcp`, use it.
4. Otherwise safely merge only `servers.excalidraw` into the default profile's user `mcp.json`.

The fallback user configuration locations are:

```text
macOS   ~/Library/Application Support/Code/User/mcp.json
Windows %APPDATA%\Code\User\mcp.json
Linux   ~/.config/Code/User/mcp.json
```

VS Code Insiders uses the corresponding `Code - Insiders` directory. Existing MCP servers and unrelated top-level configuration are preserved.

This dual registration is intentional. VS Code extension-host chat reads MCP servers from user-profile `mcp.json`, while Agent Host can read `~/.copilot/mcp-config.json` natively. The installer never writes `.vscode/mcp.json` into arbitrary workspaces.

The Designer intentionally has no `tools:` allowlist, so it inherits the user's normal enabled host tools as well as the Excalidraw MCP tools. Narrow tool restrictions remain only where isolation is intentional, such as the Critic.

## VS Code profiles

A non-default VS Code profile is not mapped from its display name to its internal profile directory by guessing. If the installed VS Code CLI supports `--add-mcp`, set:

```text
EXCALIDRAW_SKILL_VSCODE_PROFILE="Work" npm run skill:install:global
```

If that CLI build does not support `--add-mcp`, open **MCP: Open User Configuration** in the target profile and provide that exact path:

```text
EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG="/path/to/profile/mcp.json" npm run skill:install:global
```

For VS Code Insiders or another executable:

```text
EXCALIDRAW_SKILL_VSCODE_CLI=code-insiders npm run skill:install:global
```

## Verify

`npm run skill:doctor:global` should report the core installation fields as true:

```text
ok: true
skillOk: true
runtimeOk: true
agentsOk: true
mcpOk: true
```

For VS Code MCP registration, the strongest result is:

```text
vscodeMcpRegisteredAtInstall: true
vscodeMcpLiveConfigMatch: true
vscodeMcpStatus: "registered-and-verified"
```

When registration used a newer CLI's `--add-mcp`, live config verification may not be available and the status can remain `registered-via-cli`. Use **MCP: List Servers** for the final live check.

After installation, reload VS Code or start a new Copilot Chat. If tools are cached, use **MCP: Reset Cached Tools**.

Then open an unrelated writable workspace and select **Excalidraw Designer**. A successful run should be able to call `diagram_candidates` and `diagram_review_image` without the excalidraw-skill repository being the active workspace.

## Update

```text
git pull
npm install
npm run skill:install:global
npm run skill:doctor:global
```

The managed skill/runtime directories are replaced atomically. Managed agent files, Agent Host MCP registration, and VS Code user-profile MCP registration are refreshed while unrelated configuration is preserved.

## Safety

The installer refuses to overwrite unmanaged skill/runtime directories, same-name user agent files, or a different managed-name MCP server unless `--force` is explicitly supplied.

```text
npm run skill:install:global -- --force
```

Do not use `--force` as a generic fix for installation errors.

## Uninstall

```text
npm run skill:uninstall:global
```

If the installer directly managed a user `mcp.json`, uninstall removes `servers.excalidraw` only when it still exactly matches the managed server and preserves all unrelated configuration. If registration was performed by the VS Code CLI, remove it through **MCP: List Servers** or **MCP: Open User Configuration** when requested by the uninstall report.

## Troubleshooting

If VS Code does not show the server:

- `mcpOk: false`: inspect `~/.copilot/mcp-config.json`; this is Agent Host registration.
- `vscodeMcpLiveConfigMatch: false`: inspect the path shown in `vscodeMcpConfigPath` and compare it with **MCP: Open User Configuration**.
- named profile + old CLI: set `EXCALIDRAW_SKILL_VSCODE_MCP_CONFIG` to the exact file opened by **MCP: Open User Configuration**.
- tools still missing after a correct file: run **MCP: List Servers**, reload VS Code, and use **MCP: Reset Cached Tools**.

The repository-local cognitive setup still uses checked-in `.github/agents/*.agent.md` and `.mcp.json`. Global installation makes the same Designer/Planner/Critic + MCP workflow available from unrelated workspaces.
