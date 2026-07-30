## What gets written

Better Peacock installs one small helper and merges hook handlers into the
configuration file each agent already uses:

| Agent | File |
| --- | --- |
| Codex | `~/.codex/hooks.json` |
| Claude Code | `~/.claude/settings.json` |

The helper lives at `~/.better-peacock/agent-beacon.cjs`.

## What it does

The helper receives lifecycle events on standard input and writes a small
state-only JSON record to your operating system's temporary directory —
provider, state, workspace path, session id, and a timestamp.

It does not read, copy, or transmit conversation transcripts, and nothing
leaves your machine.

## Safety

- Existing hook files are **backed up** before anything is merged.
- Handlers are appended as their own entries, so your other hooks are untouched.
- **Uninstall Agent Beacon Hooks** removes only Better Peacock's handlers and
  leaves the rest of the file intact.
