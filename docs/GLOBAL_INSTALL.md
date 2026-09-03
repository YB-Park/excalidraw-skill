# Global Installation

Use this mode when the full `excalidraw-skill` cognitive workflow should be available from arbitrary workspaces on the same machine through Copilot.

> Current distribution model: install from a checkout of this repository. The default path does not require `npm install -g`, a system-wide symlink, or administrator privileges.

## Requirements

- Node.js `20.20+`
- npm `10+`
- Git
- VS Code/Copilot with custom agents and MCP enabled

For automatic VS Code user-profile MCP registration, the `code` CLI should be on `PATH`. On macOS, run **Shell Command: Install 'code' command in PATH** if needed.

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

It also asks VS Code itself to register the same MCP server in the VS Code **user profile** by running the supported CLI equivalent of:

```text
code --add-mcp '{"name":"excalidraw","type":"stdio","command":"<node>","args":["<managed-runtime>/mcp/server.mjs"]}'
```

This dual registration is intentional. Normal VS Code extension-host chat reads MCP servers from its user-profile `mcp.json`, while Agent Host can read `~/.copilot/mcp-config.json` natively. The installer does not guess or edit VS Code profile file paths directly and does not write `.vscode/mcp.json` into arbitrary workspaces.

The skill directory contains the Copilot skill bundle. The tools directory is a self-contained runtime with the deterministic kernel, MCP server, and production dependency tree. The three user-level agents are then available across workspaces. The installer merges an `excalidraw` stdio server into `~/.copilot/mcp-config.json` and preserves unrelated servers, inputs, and other configuration.

The Designer intentionally has no `tools:` allowlist, so it inherits the user's normal enabled host tools as well as the globally registered Excalidraw MCP tools. Narrow tool restrictions remain only on subagents where isolation is intentional, such as the Critic.

On Windows, `~` means the current user's home directory.

## VS Code profiles

VS Code profiles can each have their own MCP user configuration. By default, `code --add-mcp` targets the CLI's user profile. To explicitly install into a named profile, set:

```text
EXCALIDRAW_SKILL_VSCODE_PROFILE="Work" npm run skill:install:global
```

The installer passes `--profile "Work"` to the VS Code CLI. If you use multiple profiles, install once for each profile that should expose the Excalidraw MCP tools.

For VS Code Insiders or a nonstandard executable, set:

```text
EXCALIDRAW_SKILL_VSCODE_CLI=code-insiders npm run skill:install:global
```

## Verify

`npm run skill:doctor:global` should report these core fields as true:

```text
ok: true
skillOk: true
runtimeOk: true
agentsOk: true
mcpOk: true
```

The report also includes VS Code-specific fields such as:

```text
vscodeCliAvailable: true
vscodeMcpRegisteredAtInstall: true
vscodeMcpStatus: "registered-via-cli-unverified"
```

`registered-via-cli-unverified` is deliberate wording: the installer observed a successful `code --add-mcp` exit, but the public CLI does not provide a documented command for reading back the active profile's MCP configuration. Use **MCP: List Servers** in VS Code for the final live check.

`cliOk` may be false. That only means the optional `excalidraw-skill` convenience command is not on `PATH`; the agents and MCP server can still use the managed runtime directly.

If the VS Code CLI is unavailable, global install still succeeds for the managed skill/runtime/agents and Agent Host MCP configuration. The install/doctor output gives remediation: install the `code` shell command or run **MCP: Add Server** and choose **Global**.

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

The managed skill/runtime directories are replaced atomically, managed agent files are refreshed, the Agent Host `servers.excalidraw` entry is updated, and VS Code user-profile registration is refreshed through `code --add-mcp`. Unrelated Agent Host MCP configuration is preserved.

## Safety

The installer refuses to overwrite unmanaged skill/runtime directories, same-name user agent files, or an existing different Agent Host `servers.excalidraw` entry unless `--force` is explicitly supplied. These conflicts are preflighted before installation writes integration files, so a rejected install does not partially add agents or change Agent Host MCP configuration.

Use force only when replacing those user-owned entries is intentional:

```text
npm run skill:install:global -- --force
```

Do not use `--force` as a generic fix for installation errors.

## Uninstall

```text
npm run skill:uninstall:global
```

Uninstall removes the managed skill/runtime directories, the three managed agent files when they still match the installed sources, and the managed Agent Host `servers.excalidraw` entry. Other Agent Host MCP servers and unrelated configuration are preserved.

VS Code currently documents `--add-mcp` but not a matching `--remove-mcp` CLI. Therefore uninstall does **not** guess profile storage paths or silently edit profile internals. If automatic VS Code registration previously succeeded, uninstall reports `vscodeMcpRemovalRequired: true`; remove `excalidraw` with **MCP: List Servers** or **MCP: Open User Configuration** in each profile where it was installed.

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

Or set a custom Copilot home, which also moves the managed agents and Agent Host MCP config:

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

If `doctor --global` fails or VS Code does not show the MCP server:

- `skillOk: false`: check the managed skill directory and install marker.
- `runtimeOk: false`: reinstall from a complete checkout after `npm install`; the runtime must include the MCP server and production dependencies.
- `agentsOk: false`: check `~/.copilot/agents` for missing or modified managed agent files.
- `mcpOk: false`: inspect `~/.copilot/mcp-config.json`; this field describes Agent Host registration.
- `vscodeCliAvailable: false`: install the `code` shell command or add the server through **MCP: Add Server → Global**.
- `vscodeMcpRegisteredAtInstall: true` but no tools appear: run **MCP: List Servers**, confirm the intended VS Code profile, then use **MCP: Reset Cached Tools** if needed.
- `cliOk: false` only: safe to ignore unless you explicitly want the terminal convenience command.

For a machine-assisted setup, an agent can follow `docs/AGENT_SETUP.md`.
