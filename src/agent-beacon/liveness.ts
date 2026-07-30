import * as vscode from 'vscode';
import { AgentBeaconProvider } from './types';

/**
 * Installing a hook file is not the same as having working hooks. Codex in
 * particular requires the user to separately trust new hook definitions, and
 * an untrusted hook never runs — so a successful write to `~/.codex/hooks.json`
 * can look like a clean install while the feature is entirely dead.
 *
 * This module keeps the small amount of history needed to tell those apart:
 * when Better Peacock wrote hooks for a provider, when that provider's hooks
 * last actually fired, and whether the agent has been used since installation.
 */

export const livenessStateKey = 'betterPeacock.agentBeacon.liveness';

/** A session that begins at almost the same moment as installation may legitimately miss the new hooks. */
export const hookSettleMilliseconds = 60 * 1000;

export type HookLiveness =
  | 'not-installed'
  /** Installed, but the agent has not been used since — nothing to conclude yet. */
  | 'awaiting-first-event'
  /** Hooks have fired since installation. */
  | 'live'
  /** The agent ran after installation and still no hook fired. Something is wrong. */
  | 'silent';

export interface AgentBeaconLivenessState {
  /** When Better Peacock last wrote hooks for each provider. */
  installedAt?: { [provider: string]: number };
  /** When each provider's hooks last actually fired. */
  lastHookEventAt?: { [provider: string]: number };
  /** Providers already warned about, so the nudge appears once rather than every poll. */
  warnedFor?: string[];
}

/**
 * Decides whether a provider's hooks are working, using observed hook events
 * rather than elapsed time. `agentActivityAt` is the last time the agent itself
 * ran (from its own session files); without it, silence is ambiguous and this
 * deliberately reports `awaiting-first-event` instead of crying wolf.
 */
export function evaluateHookLiveness(
  state: AgentBeaconLivenessState,
  provider: AgentBeaconProvider,
  agentActivityAt: number | undefined,
  settleMilliseconds = hookSettleMilliseconds,
): HookLiveness {
  const installedAt = state.installedAt && state.installedAt[provider];
  if (!installedAt) {
    return 'not-installed';
  }

  const lastHookEventAt = (state.lastHookEventAt && state.lastHookEventAt[provider]) || 0;
  if (lastHookEventAt >= installedAt) {
    return 'live';
  }

  // The agent has to have actually run after the hooks landed before silence
  // means anything.
  if (agentActivityAt && agentActivityAt > installedAt + settleMilliseconds) {
    return 'silent';
  }

  return 'awaiting-first-event';
}

export function recordInstall(
  state: AgentBeaconLivenessState,
  provider: AgentBeaconProvider,
  timestamp: number,
): AgentBeaconLivenessState {
  return {
    ...state,
    installedAt: { ...state.installedAt, [provider]: timestamp },
    // Re-installing rewrites the hook definitions, which invalidates any prior
    // trust, so a past warning should be allowed to reappear.
    warnedFor: (state.warnedFor || []).filter(entry => entry !== provider),
  };
}

export function recordHookEvent(
  state: AgentBeaconLivenessState,
  provider: AgentBeaconProvider,
  timestamp: number,
): AgentBeaconLivenessState {
  const previous = (state.lastHookEventAt && state.lastHookEventAt[provider]) || 0;
  if (timestamp <= previous) {
    return state;
  }
  return {
    ...state,
    lastHookEventAt: { ...state.lastHookEventAt, [provider]: timestamp },
  };
}

export function recordWarning(
  state: AgentBeaconLivenessState,
  provider: AgentBeaconProvider,
): AgentBeaconLivenessState {
  if ((state.warnedFor || []).includes(provider)) {
    return state;
  }
  return { ...state, warnedFor: [...(state.warnedFor || []), provider] };
}

export function forgetInstall(
  state: AgentBeaconLivenessState,
  provider: AgentBeaconProvider,
): AgentBeaconLivenessState {
  const installedAt = { ...state.installedAt };
  const lastHookEventAt = { ...state.lastHookEventAt };
  delete installedAt[provider];
  delete lastHookEventAt[provider];
  return {
    installedAt,
    lastHookEventAt,
    warnedFor: (state.warnedFor || []).filter(entry => entry !== provider),
  };
}

export function getHomeDirectory() {
  if (vscode.env.uiKind === vscode.UIKind.Web) {
    return undefined;
  }
  return process.env.HOME || process.env.USERPROFILE;
}

let store: vscode.Memento | undefined;

export function initializeLivenessStore(memento: vscode.Memento) {
  store = memento;
}

export function readLivenessState(): AgentBeaconLivenessState {
  return store ? store.get<AgentBeaconLivenessState>(livenessStateKey, {}) : {};
}

export async function updateLivenessState(
  mutate: (state: AgentBeaconLivenessState) => AgentBeaconLivenessState,
) {
  if (!store) {
    return;
  }
  const next = mutate(readLivenessState());
  await store.update(livenessStateKey, next);
}

/**
 * Newest modification time under a directory, searched depth-first but bounded.
 * Codex nests sessions as `sessions/YYYY/MM/DD`, so a shallow bound is enough
 * to reach the day directory whose mtime moves when a session is written.
 */
async function newestModification(uri: vscode.Uri, depth: number): Promise<number> {
  let newest = 0;
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return 0;
  }

  for (const [name, type] of entries) {
    const child = vscode.Uri.joinPath(uri, name);
    if (type === vscode.FileType.Directory) {
      if (depth > 0) {
        newest = Math.max(newest, await newestModification(child, depth - 1));
      }
      continue;
    }
    try {
      const stat = await vscode.workspace.fs.stat(child);
      newest = Math.max(newest, stat.mtime);
    } catch {
      // The agent may be rotating files while this runs.
    }
  }
  return newest;
}

/**
 * When the agent itself last wrote a session file. This is the evidence that
 * turns "no hook events" from ambiguous into a real fault.
 */
export async function readAgentActivity(home: string, provider: AgentBeaconProvider) {
  const root =
    provider === 'codex'
      ? vscode.Uri.file(`${home}/.codex/sessions`)
      : vscode.Uri.file(`${home}/.claude/projects`);
  const newest = await newestModification(root, 3);
  return newest || undefined;
}

/**
 * Codex records granted hook trust separately from the hook definitions, and
 * the trust is keyed to the definitions — so appending hooks invalidates it.
 * Absence is a strong hint that hooks were never approved; presence is not
 * proof they are current, which is why this only ever supplements
 * `evaluateHookLiveness`.
 */
export async function hasCodexHookTrust(home: string) {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(`${home}/.codex/hooks.state`));
    return true;
  } catch {
    return false;
  }
}
