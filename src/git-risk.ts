import * as vscode from 'vscode';
import { getGitRiskAheadBehindThreshold, getGitRiskEnabled } from './configuration';
import { getCurrentGitRepository, GitRepository, watchGitState } from './automatic-color/git';
import { StandardSettings } from './models';

export interface GitRiskSnapshot {
  changes: number;
  conflicts: number;
  ahead: number;
  behind: number;
}

export interface GitRiskSummary extends GitRiskSnapshot {
  visible: boolean;
  text: string;
}

export function getGitRiskSnapshot(repository: GitRepository | undefined): GitRiskSnapshot {
  const state = repository && repository.state;
  return {
    changes:
      ((state && state.indexChanges && state.indexChanges.length) || 0) +
      ((state && state.workingTreeChanges && state.workingTreeChanges.length) || 0),
    conflicts: (state && state.mergeChanges && state.mergeChanges.length) || 0,
    ahead: (state && state.HEAD && state.HEAD.ahead) || 0,
    behind: (state && state.HEAD && state.HEAD.behind) || 0,
  };
}

export function summarizeGitRisk(snapshot: GitRiskSnapshot, threshold: number): GitRiskSummary {
  const parts: string[] = [];
  if (snapshot.conflicts) {
    parts.push(`$(warning) ${snapshot.conflicts}`);
  }
  if (snapshot.changes) {
    parts.push(`$(diff) ${snapshot.changes}`);
  }
  if (snapshot.ahead >= threshold) {
    parts.push(`↑${snapshot.ahead}`);
  }
  if (snapshot.behind >= threshold) {
    parts.push(`↓${snapshot.behind}`);
  }
  return { ...snapshot, visible: parts.length > 0, text: parts.join(' ') };
}

let statusBarItem: vscode.StatusBarItem | undefined;
let refreshHandle: NodeJS.Timeout | undefined;

async function refreshGitRisk() {
  if (!statusBarItem || !getGitRiskEnabled()) {
    if (statusBarItem) {
      statusBarItem.hide();
    }
    return;
  }
  const summary = summarizeGitRisk(
    getGitRiskSnapshot(await getCurrentGitRepository()),
    Math.max(1, getGitRiskAheadBehindThreshold()),
  );
  if (!summary.visible) {
    statusBarItem.hide();
    return;
  }
  statusBarItem.text = summary.text;
  statusBarItem.backgroundColor = summary.conflicts
    ? new vscode.ThemeColor('statusBarItem.errorBackground')
    : undefined;
  statusBarItem.tooltip = [
    'Better Peacock Git Risk',
    summary.conflicts ? `Conflicts: ${summary.conflicts}` : '',
    summary.changes ? `Staged or unstaged changes: ${summary.changes}` : '',
    summary.ahead ? `Unpushed commits: ${summary.ahead}` : '',
    summary.behind ? `Commits behind upstream: ${summary.behind}` : '',
    'Click to open Source Control',
  ]
    .filter(Boolean)
    .join('\n');
  statusBarItem.show();
}

function scheduleRefresh() {
  if (refreshHandle) {
    clearTimeout(refreshHandle);
  }
  refreshHandle = setTimeout(() => refreshGitRisk(), 200);
}

export async function initializeGitRisk(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusBarItem.name = 'Better Peacock Git Risk';
  statusBarItem.command = 'workbench.view.scm';
  context.subscriptions.push(
    statusBarItem,
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration(`peacock.${StandardSettings.GitRiskEnabled}`) ||
        event.affectsConfiguration(`peacock.${StandardSettings.GitRiskAheadBehindThreshold}`)
      ) {
        scheduleRefresh();
      }
    }),
    {
      dispose: () => {
        if (refreshHandle) {
          clearTimeout(refreshHandle);
        }
      },
    },
  );
  await watchGitState(context, scheduleRefresh);
  await refreshGitRisk();
}
