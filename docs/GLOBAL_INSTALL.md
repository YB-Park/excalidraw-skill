# Global Installation

Use this mode when the skill should be available from any workspace on the same machine.

## Default install

From a checkout of this repository:

```text
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

This path does not require `npm install -g`, a system-wide symlink, or administrator privileges.

The installer creates two managed directories under the current user's home directory:

```text
~/.copilot/skills/excalidraw-skill
~/.copilot/tools/excalidraw-skill
```

The first directory is the Copilot skill bundle. The second is the executable runtime used by the skill. The skill reads `runtimeEntry` from `.excalidraw-skill-install.json` and invokes it with Node.js.

On Windows, `~` resolves to the current user's home directory.

## Verify

`npm run skill:doctor:global` should report:

```text
ok: true
skillOk: true
runtimeOk: true
```

`cliOk` may be false. That only means the optional convenience command is not on `PATH`; the installed skill can still use its managed runtime directly.

## Update

After pulling a newer version of the repository:

```text
git pull
npm install
npm test
npm run skill:install:global
npm run skill:doctor:global
```

Both managed directories are replaced atomically. Files left over from older versions are removed.

## Optional PATH command

Installing the `excalidraw-skill` command globally is optional. It is not required for Copilot to use the skill.

Do not use `sudo npm install -g .` as the default solution to an `EACCES` error. A root-owned npm installation can make later updates and removal require elevated privileges and can leave root-owned files in npm directories.

Preferred options are:

1. Install Node.js through a user-owned Node version manager.
2. On macOS or Linux, configure a user-owned npm prefix.

Example user prefix setup:

```text
npm config set prefix ~/.local
```

Add this directory to the shell `PATH`:

```text
~/.local/bin
```

Then the convenience command can be installed without `sudo`:

```text
npm install -g .
excalidraw-skill doctor --global
```

Using `sudo` is acceptable only in an intentionally administrator-managed environment where system-wide Node packages are expected and the user accepts that future updates and uninstall operations may also require `sudo`.

## Safety

The installer writes management markers inside both directories.

If either target already exists without its marker, installation stops instead of overwriting user files. Replace unmanaged directories only when intentional:

```text
npm run skill:install:global -- --force
```

## Uninstall

```text
npm run skill:uninstall:global
```

Both the skill bundle and the managed runtime are removed. Unmanaged directories are not removed unless `--force` is supplied.

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

Project-local entrypoints remain available:

```text
npm install
npm run init
```

This creates `.opencode/commands/excalidraw.md` and `.github/prompts/excalidraw.prompt.md` in the current workspace. It does not install anything into `~/.copilot`.

## After installation

Start a new Copilot chat or reload VS Code so the global skill directory is scanned again.
