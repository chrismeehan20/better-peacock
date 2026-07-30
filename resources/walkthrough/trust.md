## Why this step exists

Writing a hook file is not enough for Codex. Codex records trust for hook
definitions separately, and it silently skips any hook it has not been told to
trust — so hooks can look perfectly installed while never running once.

Claude Code needs no equivalent step. It picks up new hooks on the next session.

## Steps

1. Open Codex.
2. Run `/hooks`.
3. Review the Better Peacock entries and approve them.
4. Start a new Codex session.
5. Run **Verify Agent Beacon Hooks**.

## Trust is tied to the definitions

Because trust is keyed to the hook definitions themselves, reinstalling or
changing hooks invalidates it and you will need to approve them again.

**Verify Agent Beacon Hooks** reports what is actually happening rather than
what was configured: it tells you whether each agent's hooks have genuinely
fired since installation, and flags the case where an agent has run without
sending a single event.
