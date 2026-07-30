import * as vscode from 'vscode';
import {
  getAgentBeaconEnabled,
  getAgentBeaconNotifications,
  getAgentBeaconPollInterval,
  getAgentBeaconStaleMinutes,
} from '../configuration';
import { Logger } from '../logging';
import { Commands, StandardSettings } from '../models';
import {
  evaluateHookLiveness,
  getHomeDirectory,
  initializeLivenessStore,
  readAgentActivity,
  readLivenessState,
  recordHookEvent,
  recordWarning,
  updateLivenessState,
} from './liveness';
import {
  installAgentBeaconHooks,
  providerDisplayName,
  uninstallAgentBeaconHooks,
  verifyAgentBeaconHooks,
} from './setup';
import { AgentBeaconTreeProvider } from './tree';
import { AgentBeaconProvider, AgentBeaconState, AgentBeaconStateName } from './types';

let statusBarItem: vscode.StatusBarItem | undefined;
let treeProvider: AgentBeaconTreeProvider | undefined;
let pollHandle: NodeJS.Timeout | undefined;
let pollInProgress = false;
let lastNotificationKey = '';
let lastLivenessCheck = 0;

/** Checking hook liveness means touching the agents' session directories, so it runs far less often than the state poll. */
const livenessCheckInterval = 5 * 60 * 1000;

const statePriority: { [state in AgentBeaconStateName]: number } = {
  'needs-input': 4,
  failed: 3,
  ready: 2,
  running: 1,
};

function getStateDirectoryUri() {
  if (vscode.env.uiKind === vscode.UIKind.Web) {
    return undefined;
  }
  const temporaryDirectory = process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
  return vscode.Uri.joinPath(vscode.Uri.file(temporaryDirectory), 'better-peacock-agent-beacon');
}

function decode(value: Uint8Array) {
  return Buffer.from(value).toString('utf8');
}

function isFileNotFound(error: unknown) {
  return /FileNotFound|ENOENT/i.test(String(error));
}

function isAgentBeaconState(value: any): value is AgentBeaconState {
  return (
    value &&
    value.version === 1 &&
    (value.provider === 'codex' || value.provider === 'claude') &&
    ['running', 'needs-input', 'ready', 'failed'].includes(value.state) &&
    typeof value.workspace === 'string' &&
    typeof value.timestamp === 'number'
  );
}

export async function readAgentBeaconStates() {
  const directory = getStateDirectoryUri();
  if (!directory) {
    return [] as AgentBeaconState[];
  }
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(directory);
  } catch (error) {
    if (isFileNotFound(error)) {
      return [] as AgentBeaconState[];
    }
    throw error;
  }

  const staleAfter = getAgentBeaconStaleMinutes() * 60 * 1000;
  const states: AgentBeaconState[] = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File || !name.endsWith('.json')) {
      continue;
    }
    const uri = vscode.Uri.joinPath(directory, name);
    try {
      const parsed = JSON.parse(decode(await vscode.workspace.fs.readFile(uri)));
      if (!isAgentBeaconState(parsed)) {
        continue;
      }
      if (Date.now() - parsed.timestamp > staleAfter) {
        await vscode.workspace.fs.delete(uri);
        continue;
      }
      states.push({ ...parsed, sourceUri: uri.toString() });
    } catch {
      // A hook may be replacing a state file while it is being scanned.
    }
  }
  return states;
}

function normalizePath(value: string) {
  const normalized = value.replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function stateBelongsToWorkspace(state: AgentBeaconState, workspacePath: string) {
  const statePath = normalizePath(state.workspace);
  const rootPath = normalizePath(workspacePath);
  return (
    statePath === rootPath ||
    statePath.startsWith(`${rootPath}/`) ||
    rootPath.startsWith(`${statePath}/`)
  );
}

export function selectPrimaryAgentState(states: AgentBeaconState[], workspacePaths: string[]) {
  return states
    .filter(state => workspacePaths.some(root => stateBelongsToWorkspace(state, root)))
    .sort(
      (left, right) =>
        statePriority[right.state] - statePriority[left.state] || right.timestamp - left.timestamp,
    )[0];
}

function providerLabel(state: AgentBeaconState) {
  return state.provider === 'claude' ? 'Claude' : 'Codex';
}

function statePresentation(state: AgentBeaconState) {
  const provider = providerLabel(state);
  switch (state.state) {
    case 'running':
      return { text: `$(sync~spin) ${provider} working`, description: 'Working' };
    case 'needs-input':
      return {
        text: `$(bell) ${provider} needs input`,
        description: 'Needs input',
        background: new vscode.ThemeColor('statusBarItem.warningBackground'),
      };
    case 'ready':
      return { text: `$(pass-filled) ${provider} ready`, description: 'Ready', color: '#2ea043' };
    case 'failed':
      return {
        text: `$(error) ${provider} failed`,
        description: 'Failed',
        background: new vscode.ThemeColor('statusBarItem.errorBackground'),
      };
  }
}

function updateStatusBar(state: AgentBeaconState | undefined) {
  if (!statusBarItem) {
    return;
  }
  if (!getAgentBeaconEnabled() || !state) {
    statusBarItem.hide();
    return;
  }
  const presentation = statePresentation(state);
  statusBarItem.text = presentation.text;
  statusBarItem.color = presentation.color;
  statusBarItem.backgroundColor = presentation.background;
  statusBarItem.command = Commands.showAttentionQueue;
  statusBarItem.tooltip = [
    `Agent Beacon: ${presentation.description}`,
    `Provider: ${providerLabel(state)}`,
    `Workspace: ${state.workspace}`,
    state.message ? `Message: ${state.message}` : '',
    'Click to show the Attention Queue',
  ]
    .filter(Boolean)
    .join('\n');
  statusBarItem.show();
}

async function notifyForTransition(state: AgentBeaconState | undefined) {
  if (
    !state ||
    state.state === 'running' ||
    !getAgentBeaconNotifications() ||
    vscode.window.state.focused
  ) {
    return;
  }
  const key = `${state.provider}:${state.sessionId}:${state.state}:${state.timestamp}`;
  if (key === lastNotificationKey) {
    return;
  }
  lastNotificationKey = key;
  if (Date.now() - state.timestamp > Math.max(10000, getAgentBeaconPollInterval() * 3)) {
    return;
  }
  const presentation = statePresentation(state);
  const choice = await vscode.window.showInformationMessage(
    `${providerLabel(state)} ${presentation.description.toLowerCase()} in ${workspaceName(
      state.workspace,
    )}.`,
    'Show Queue',
  );
  if (choice === 'Show Queue') {
    await showAttentionQueue();
  }
}

/**
 * Every observed state record is proof that the provider's hooks ran. Recording
 * that is what lets Better Peacock tell "installed and working" apart from
 * "installed and silently ignored" — the failure mode Codex hits when its hook
 * definitions have not been trusted.
 */
async function recordObservedHookEvents(states: AgentBeaconState[]) {
  const newest = new Map<AgentBeaconProvider, number>();
  states.forEach(state => {
    const previous = newest.get(state.provider) || 0;
    if (state.timestamp > previous) {
      newest.set(state.provider, state.timestamp);
    }
  });
  for (const [provider, timestamp] of newest) {
    await updateLivenessState(state => recordHookEvent(state, provider, timestamp));
  }
}

/**
 * Warns once per provider when the agent has demonstrably run since hooks were
 * installed without producing a single hook event.
 */
async function checkHookLiveness() {
  const home = getHomeDirectory();
  if (!home || Date.now() - lastLivenessCheck < livenessCheckInterval) {
    return;
  }
  lastLivenessCheck = Date.now();

  const stored = readLivenessState();
  for (const provider of ['codex', 'claude'] as AgentBeaconProvider[]) {
    if ((stored.warnedFor || []).includes(provider)) {
      continue;
    }
    // Only a provider that is installed and has never fired is worth the cost
    // of scanning session files; 'live' and 'not-installed' are decided from
    // stored timestamps alone.
    if (evaluateHookLiveness(stored, provider, undefined) !== 'awaiting-first-event') {
      continue;
    }
    const activityAt = await readAgentActivity(home, provider);
    if (evaluateHookLiveness(stored, provider, activityAt) !== 'silent') {
      continue;
    }

    await updateLivenessState(state => recordWarning(state, provider));
    Logger.info(
      `Better Peacock: ${providerDisplayName(
        provider,
      )} ran after Agent Beacon installation but sent no hook events.`,
    );
    const choice = await vscode.window.showWarningMessage(
      `Agent Beacon: ${providerDisplayName(
        provider,
      )} has run since its hooks were installed but has not sent a single hook event.`,
      'Diagnose',
    );
    if (choice === 'Diagnose') {
      await verifyAgentBeaconHooks();
    }
  }
}

async function poll() {
  if (pollInProgress) {
    return;
  }
  pollInProgress = true;
  try {
    if (!getAgentBeaconEnabled()) {
      updateStatusBar(undefined);
      treeProvider?.setStates([]);
      return;
    }
    const roots = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri.fsPath);
    const states = await readAgentBeaconStates();
    const state = selectPrimaryAgentState(states, roots);
    updateStatusBar(state);
    treeProvider?.setStates(states);
    await recordObservedHookEvents(states);
    await notifyForTransition(state);
    await checkHookLiveness();
  } finally {
    pollInProgress = false;
  }
}

function startPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = undefined;
  }
  if (!getAgentBeaconEnabled()) {
    updateStatusBar(undefined);
    return;
  }
  pollHandle = setInterval(() => poll(), Math.max(500, getAgentBeaconPollInterval()));
  poll();
}

function workspaceName(workspacePath: string) {
  const parts = normalizePath(workspacePath).split('/');
  return parts[parts.length - 1] || workspacePath;
}

function relativeAge(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}

interface AttentionItem extends vscode.QuickPickItem {
  state: AgentBeaconState;
}

export async function showAttentionQueue() {
  const allStates = await readAgentBeaconStates();
  const attentionStates = allStates
    .filter(state => state.state !== 'running')
    .sort(
      (left, right) =>
        statePriority[right.state] - statePriority[left.state] || right.timestamp - left.timestamp,
    );
  if (!attentionStates.length) {
    const running = allStates.filter(state => state.state === 'running').length;
    await vscode.window.showInformationMessage(
      running
        ? `No projects need attention. ${running} agent${
            running === 1 ? ' is' : 's are'
          } still working.`
        : 'No Agent Beacon projects currently need attention.',
    );
    return;
  }

  const item = await vscode.window.showQuickPick<AttentionItem>(
    attentionStates.map(state => {
      const presentation = statePresentation(state);
      return {
        label: `${presentation.text} — ${workspaceName(state.workspace)}`,
        description: relativeAge(state.timestamp),
        detail: state.workspace,
        state,
      };
    }),
    {
      placeHolder: 'Select a project to open it in VS Code',
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );
  if (item) {
    await openAgentBeaconProject(item.state);
  }
}

/** Opens the project in a new window, unless this window already holds it. */
export async function openAgentBeaconProject(state: AgentBeaconState) {
  const currentRoots = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri.fsPath);
  if (currentRoots.some(root => stateBelongsToWorkspace(state, root))) {
    return;
  }
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(state.workspace), {
    forceNewWindow: true,
  });
}

export function initializeAgentBeacon(context: vscode.ExtensionContext) {
  initializeLivenessStore(context.globalState);
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 200);
  statusBarItem.name = 'Better Peacock Agent Beacon';
  treeProvider = new AgentBeaconTreeProvider();
  context.subscriptions.push(
    statusBarItem,
    treeProvider,
    vscode.window.registerTreeDataProvider('betterPeacock.attentionQueue', treeProvider),
    vscode.commands.registerCommand(Commands.installAgentBeacon, () =>
      installAgentBeaconHooks(context),
    ),
    vscode.commands.registerCommand(Commands.uninstallAgentBeacon, uninstallAgentBeaconHooks),
    vscode.commands.registerCommand(Commands.verifyAgentBeacon, verifyAgentBeaconHooks),
    vscode.commands.registerCommand(Commands.showAttentionQueue, showAttentionQueue),
    vscode.commands.registerCommand(Commands.openAgentBeaconProject, openAgentBeaconProject),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration(`peacock.${StandardSettings.AgentBeaconEnabled}`) ||
        event.affectsConfiguration(`peacock.${StandardSettings.AgentBeaconPollInterval}`) ||
        event.affectsConfiguration(`peacock.${StandardSettings.AgentBeaconStaleMinutes}`) ||
        event.affectsConfiguration(`peacock.${StandardSettings.AgentBeaconNotifications}`)
      ) {
        startPolling();
      }
    }),
    {
      dispose: () => {
        if (pollHandle) {
          clearInterval(pollHandle);
        }
      },
    },
  );
  startPolling();
}

export * from './liveness';
export * from './node-runtime';
export * from './setup';
export * from './tree';
export * from './types';
