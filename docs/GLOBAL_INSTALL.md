# Global Installation

Use this mode when `excalidraw-skill` should be available from any workspace on the same machine through Copilot.

> Current distribution model: install from a checkout of this repository. The default path does not require `npm install -g`, a system-wide symlink, or administrator privileges.

## Requirements

- Node.js `20.20+`
- npm `10+`
- Git

Check versions:

```text
node --version
npm --version
git --version
```

## Install

From a checkout of this repository:

```text
npm install
npm run skill:install:global
npm run skill:doctor:global
```

The installer creates two managed directories under the current user's home directory:

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

The first directory is the Copilot skill bundle. The second is the executable runtime used by the skill. The skill reads the absolute `runtimeEntry` from `.excalidraw-skill-install.json` and invokes it with Node.js.

On Windows, `~` means the current user's home directory.

## Verify

`npm run skill:doctor:global` should report these fields as true:

```text
ok: true
skillOk: true
runtimeOk: true
```

`cliOk` may be false. That only means the optional `excalidraw-skill` convenience command is not on `PATH`; the Copilot skill can still use its managed runtime directly.

After installation, reload VS Code or start a new Copilot Chat so the global skill directory is scanned again.

Then test from an unrelated writable workspace:

```text
결제 승인 흐름을 Excalidraw 다이어그램으로 만들어줘.
excalidraw-skill을 사용하고 결과는 diagrams/payment-approval.excalidraw에 저장해줘.
```

A successful first run should create the requested `.excalidraw` file and quality/editability reports without requiring commands to be run inside the excalidraw-skill repository.

## Update

After pulling a newer version of the repository:

```text
git pull
npm install
npm run skill:install:global
npm run skill:doctor:global
```

Both managed directories are replaced atomically. Files left over from older managed versions are removed.

For contributors or when validating a runtime change, run `npm test` before reinstalling. It is not required as part of the normal end-user update path.

## Safety

The installer writes management markers inside both directories.

If either target already exists without its marker, installation stops instead of overwriting user files. Replace an unmanaged directory only when intentional:

```text
npm run skill:install:global -- --force
```

Do not use `--force` as a generic fix for installation errors.

## Uninstall

```text
npm run skill:uninstall:global
```

Both the skill bundle and the managed runtime are removed. Unmanaged directories are not removed unless `--force` is supplied.

After removal, reload VS Code or start a new Copilot Chat.

## Optional PATH command

Installing the `excalidraw-skill` terminal command globally is optional. It is not required for Copilot to use the skill.

Do not use `sudo npm install -g .` as the default solution to an `EACCES` error. A root-owned npm installation can make later updates and removal require elevated privileges.

Preferred options are:

1. Install Node.js through a user-owned Node version manager.
2. On macOS or Linux, configure a user-owned npm prefix.

Example user prefix:

```text
npm config set prefix ~/.local
```

Ensure `~/.local/bin` is on `PATH`, then:

```text
npm install -g .
excalidraw-skill doctor --global
```

Use administrator-managed npm only when that is an intentional machine policy.

## Custom locations

The skill and runtime targets can be changed for testing or nonstandard environments:

```text
EXCALIDRAW_SKILL_GLOBAL_DIR=/custom/skill/path \
EXCALIDRAW_SKILL_RUNTIME_DIR=/custom/runtime/path \
npm run skill:install:global
```

Or set a custom Copilot home:

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

This creates `.opencode/commands/excalidraw.md` and `.github/prompts/excalidraw.prompt.md` in the current workspace. It does not install anything into `~/.copilot`.

## Troubleshooting

If `doctor --global` fails:

- `skillOk: false`: check the managed skill directory and install marker.
- `runtimeOk: false`: reinstall from a complete repository checkout; do not hand-copy `src/` files.
- `cliOk: false` only: safe to ignore unless you explicitly want the terminal convenience command.
- missing Node/npm/Git: fix the prerequisite instead of using `--force`.

For a machine-assisted setup, an agent can follow `docs/AGENT_SETUP.md`.
