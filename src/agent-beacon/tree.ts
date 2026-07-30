import * as vscode from 'vscode';
import { Commands } from '../models';
import { AgentBeaconState, AgentBeaconStateName } from './types';

/**
 * The Attention Queue as a persistent view. The quick pick still exists for
 * keyboard-driven use, but a queue you have to remember to open is a queue you
 * forget, so this keeps cross-project agent state visible in every window.
 */

const stateOrder: { [state in AgentBeaconStateName]: number } = {
  'needs-input': 4,
  failed: 3,
  ready: 2,
  running: 1,
};

const stateDisplay: {
  [state in AgentBeaconStateName]: { label: string; icon: vscode.ThemeIcon };
} = {
  'needs-input': {
    label: 'Needs input',
    icon: new vscode.ThemeIcon('bell', new vscode.ThemeColor('list.warningForeground')),
  },
  failed: {
    label: 'Failed',
    icon: new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground')),
  },
  ready: { label: 'Ready', icon: new vscode.ThemeIcon('pass-filled') },
  running: { label: 'Working', icon: new vscode.ThemeIcon('sync~spin') },
};

function workspaceName(workspacePath: string) {
  const parts = workspacePath.replace(/\\/g, '/').replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || workspacePath;
}

function relativeAge(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}

class AgentBeaconTreeItem extends vscode.TreeItem {
  constructor(public readonly state: AgentBeaconState) {
    super(workspaceName(state.workspace), vscode.TreeItemCollapsibleState.None);
    const display = stateDisplay[state.state];
    this.iconPath = display.icon;
    this.description = `${display.label} · ${relativeAge(state.timestamp, Date.now())}`;
    this.tooltip = new vscode.MarkdownString(
      [
        `**${display.label}** — ${state.provider === 'claude' ? 'Claude Code' : 'Codex'}`,
        '',
        state.workspace,
        state.message ? `\n${state.message}` : '',
      ].join('\n'),
    );
    this.contextValue = `agentBeacon.${state.state}`;
    this.resourceUri = vscode.Uri.file(state.workspace);
    this.command = {
      command: Commands.openAgentBeaconProject,
      title: 'Open Project',
      arguments: [state],
    };
  }
}

export class AgentBeaconTreeProvider implements vscode.TreeDataProvider<AgentBeaconTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;
  private states: AgentBeaconState[] = [];

  /** Called from the poll loop so the view and the status bar never disagree. */
  setStates(states: AgentBeaconState[]) {
    const signature = (entries: AgentBeaconState[]) =>
      entries
        .map(entry => `${entry.provider}:${entry.sessionId}:${entry.state}:${entry.timestamp}`)
        .join('|');
    // The poll runs every second by default; only redraw when something moved.
    if (signature(states) === signature(this.states)) {
      return;
    }
    this.states = states;
    this.changeEmitter.fire();
  }

  getTreeItem(element: AgentBeaconTreeItem) {
    return element;
  }

  getChildren() {
    return [...this.states]
      .sort(
        (left, right) =>
          stateOrder[right.state] - stateOrder[left.state] || right.timestamp - left.timestamp,
      )
      .map(state => new AgentBeaconTreeItem(state));
  }

  dispose() {
    this.changeEmitter.dispose();
  }
}
