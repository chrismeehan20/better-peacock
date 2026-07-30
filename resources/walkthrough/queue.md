## The states

| State | Meaning |
| --- | --- |
| Working | The agent is mid-turn. |
| Needs input | A permission prompt or question is waiting on you. |
| Ready | The turn finished. |
| Failed | The turn ended in an error. |

## Where it shows up

- **Status bar** — the state of the agent in *this* window.
- **Agent Attention Queue** — a view in the Explorer sidebar listing *every*
  project reporting state, so a window you are not looking at still surfaces.
- **Notifications** — one message when a project needs input, finishes, or
  fails. Suppressed while the window is focused, since you can already see it.

Selecting a project in the queue opens it in a new VS Code window unless the
current window already holds it.

## Tuning

| Setting | Purpose |
| --- | --- |
| `peacock.agentBeaconEnabled` | Turns the whole feature on or off. |
| `peacock.agentBeaconNotifications` | Toggles the notifications only. |
| `peacock.agentBeaconPollInterval` | How often state files are re-read. |
| `peacock.agentBeaconStaleMinutes` | When an untouched record is discarded. |
