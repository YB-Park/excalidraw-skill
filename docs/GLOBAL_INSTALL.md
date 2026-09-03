# Global Installation

Use this mode when the full `excalidraw-skill` cognitive workflow should be available from arbitrary workspaces on the same machine through Copilot.

> Current distribution model: install from a checkout of this repository. The default path does not require `npm install -g`, a system-wide symlink, or administrator privileges.

## Requirements

- Node.js `20.20+`
- npm `10+`
- Git
- VS Code/Copilot with custom agents and MCP enabled

## Install

From a checkout of this repository:

```text
npm install
npm run skill:install:global
npm run skill:doctor:global
```

The installer manages these Copilot user locations:

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
~/.copilot/agents/excalidraw-designer.agent.md
~/.copilot/agents/excalidraw-planner.agent.md
~/.copilot/agents/excalidraw-critic.agent.md
~/.copilot/mcp-config.json  # only servers.excalidraw is managed
```

The skill directory contains the Copilot skill bundle. The tools directory is a self-contained runtime with the deterministic kernel, MCP server, and production dependency tree. The three user-level agents are then available across workspaces. The installer merges an `excalidraw` stdio server into `~/.copilot/mcp-config.json` and preserves unrelated servers, inputs, and other configuration.

The Designer intentionally has no `tools:` allowlist, so it inherits the user's normal enabled host tools as well as the globally registered Excalidraw MCP tools. Narrow tool restrictions remain only on subagents where isolation is intentional, such as the Critic.

On Windows, `~` means the current user's home directory.

## Verify

`npm run skill:doctor:global` should report these fields as true:

```text
ok: true
skillOk: true
runtimeOk: true
agentsOk: true
mcpOk: true
```

`cliOk` may be false. That only means the optional `excalidraw-skill` convenience command is not on `PATH`; the agents and MCP server can still use the managed runtime directly.

After installation, reload VS Code or start a new Copilot Chat so user-level customizations and MCP configuration are refreshed. If the MCP tool list is cached, use **MCP: Reset Cached Tools** or restart the relevant MCP server from **MCP: List Servers**.

Then open an unrelated writable workspace and select **Excalidraw Designer**. Test with:

```text
결제 승인 흐름을 편집 가능한 Excalidraw 다이어그램으로 만들어줘.
3개 candidate를 생성하고 hard gate를 확인한 뒤 실제 PNG를 blind review해줘.
결과는 diagrams/payment-approval.excalidraw에 저장해줘.
```

A successful run should be able to call the `excalidraw` MCP tools, including `diagram_candidates` and `diagram_review_image`, without requiring the excalidraw-skill repository itself to be the active workspace.

## Update

After pulling a newer version of the repository:

```text
git pull
npm install
npm run skill:install:global
npm run skill:doctor:global
```

The managed skill/runtime directories are replaced atomically, managed agent files are refreshed, and only the managed `servers.excalidraw` MCP entry is updated. Unrelated user MCP configuration is preserved.

## Safety

The installer refuses to overwrite unmanaged skill/runtime directories, same-name user agent files, or an existing different `servers.excalidraw` entry unless `--force` is explicitly supplied. These conflicts are preflighted before installation writes integration files, so a rejected install does not partially add agents or change MCP configuration.

Use force only when replacing those user-owned entries is intentional:

```text
npm run skill:install:global -- --force
```

Do not use `--force` as a generic fix for installation errors.

## Uninstall

```text
npm run skill:uninstall:global
```

Uninstall removes the managed skill/runtime directories, the three managed agent files when they still match the installed sources, and the managed `servers.excalidraw` MCP entry. Other MCP servers and unrelated configuration are preserved. User-modified same-name integration files are not removed unless `--force` is supplied.

After removal, reload VS Code or start a new Copilot Chat.

## Optional PATH command

Installing the `excalidraw-skill` terminal command globally is optional. It is not required for Copilot to use the skill, agents, or MCP server.

Do not use `sudo npm install -g .` as the default solution to an `EACCES` error. Prefer a user-owned Node version manager or npm prefix.

## Custom locations

The skill and runtime targets can be changed for testing or nonstandard environments:

```text
EXCALIDRAW_SKILL_GLOBAL_DIR=/custom/skill/path \
EXCALIDRAW_SKILL_RUNTIME_DIR=/custom/runtime/path \
npm run skill:install:global
```

Or set a custom Copilot home, which also moves the managed agents and MCP config:

```text
COPILOT_HOME=/custom/copilot-home npm run skill:install:global
```

## Project-local setup

Project-local entrypoints remain available when global installation is not wanted:

```text
npm install
npm run doctor
npm run init
```

The repository-local cognitive setup uses checked-in `.github/agents/*.agent.md` and `.mcp.json`. Global installation is what makes the same Designer/Planner/Critic + MCP workflow available from unrelated workspaces.

## Troubleshooting

If `doctor --global` fails:

- `skillOk: false`: check the managed skill directory and install marker.
- `runtimeOk: false`: reinstall from a complete checkout after `npm install`; the runtime must include the MCP server and production dependencies.
- `agentsOk: false`: check `~/.copilot/agents` for missing or modified managed agent files.
- `mcpOk: false`: inspect `~/.copilot/mcp-config.json`, then reload VS Code or reset cached MCP tools.
- `cliOk: false` only: safe to ignore unless you explicitly want the terminal convenience command.

For a machine-assisted setup, an agent can follow `docs/AGENT_SETUP.md`.
