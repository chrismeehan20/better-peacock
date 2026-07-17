import * as vscode from 'vscode';
import { applyColor, unapplyColors } from '../apply-color';
import {
  AutomaticColorSource,
  getAutoColorMode,
  getAutoColorPriority,
  getBranchColors,
  getColorBranchStatusItem,
  getEnvironmentAwareColor,
  getGitRemoteName,
  getProjectIconMaxSize,
  getProjectIconPaletteStrategy,
  getProjectIconPath,
  getProjectIconSearchPatterns,
} from '../configuration';
import { Logger } from '../logging';
import { StandardSettings } from '../models';
import { resolveBranchColor } from './branch';
import { getGitIdentity, GitIdentity, watchGitIdentity } from './git';
import { hashToColor } from './hash';
import { getProjectIconColor } from './icon';

export interface AutomaticColorState {
  color: string;
  source: 'manual' | AutomaticColorSource;
  sourceLabel: string;
  branch?: string;
  branchColor?: string;
  remoteUrl?: string;
  iconPath?: string;
}

let currentState: AutomaticColorState | undefined;
let refreshInProgress: Promise<AutomaticColorState | undefined> | undefined;

export function getAutomaticColorState() {
  return currentState;
}

function getWorkspaceIdentity() {
  if (vscode.workspace.workspaceFile) {
    return vscode.workspace.workspaceFile.toString();
  }
  const folders = vscode.workspace.workspaceFolders || [];
  return folders
    .map(folder => folder.uri.toString())
    .sort()
    .join('|');
}

async function resolveSource(source: AutomaticColorSource, git: GitIdentity) {
  switch (source) {
    case 'projectIcon': {
      const icon = await getProjectIconColor({
        path: getProjectIconPath(),
        patterns: getProjectIconSearchPatterns(),
        maxSize: getProjectIconMaxSize(),
        strategy: getProjectIconPaletteStrategy(),
      });
      return (
        icon && {
          color: icon.color,
          source,
          sourceLabel: `project icon (${vscode.workspace.asRelativePath(icon.uri)})`,
          iconPath: icon.uri.toString(),
        }
      );
    }
    case 'gitRemote':
      return git.normalizedRemote
        ? {
            color: hashToColor(git.normalizedRemote),
            source,
            sourceLabel: `Git remote ${git.normalizedRemote}`,
            remoteUrl: git.remoteUrl,
          }
        : undefined;
    case 'workspace': {
      const identity = getWorkspaceIdentity();
      return identity
        ? {
            color: hashToColor(identity),
            source,
            sourceLabel: 'workspace identity',
          }
        : undefined;
    }
  }
}

async function resolveAutomaticColor(git: GitIdentity) {
  const mode = getAutoColorMode();
  if (mode === 'off') {
    return undefined;
  }
  const sources = mode === 'auto' ? getAutoColorPriority() : [mode];
  for (const source of sources) {
    try {
      const result = await resolveSource(source, git);
      if (result) {
        return result;
      }
    } catch (error) {
      Logger.info(`Peacock: Could not resolve automatic ${source} color: ${String(error)}`);
    }
  }
  return undefined;
}

async function performRefresh() {
  if (!vscode.workspace.workspaceFolders) {
    currentState = undefined;
    return undefined;
  }

  const git = await getGitIdentity(getGitRemoteName());
  const automatic = await resolveAutomaticColor(git);
  const manualColor = getEnvironmentAwareColor();
  const base = manualColor
    ? { color: manualColor, source: 'manual' as const, sourceLabel: 'manual Peacock setting' }
    : automatic;
  const branchColor = resolveBranchColor(git.branch, getBranchColors());

  if (!base) {
    if (currentState) {
      await unapplyColors();
    }
    currentState = undefined;
    return undefined;
  }

  currentState = {
    ...base,
    branch: git.branch,
    branchColor,
    remoteUrl: ('remoteUrl' in base && base.remoteUrl) || git.remoteUrl,
  };
  await applyColor(base.color, {
    statusBarColor: branchColor,
    statusBarContext: {
      color: base.color,
      source: base.sourceLabel,
      branch: git.branch,
      branchColor,
      branchForegroundColor:
        getColorBranchStatusItem() && git.branch ? hashToColor(git.branch) : undefined,
    },
  });
  Logger.info(
    `Peacock: Applied ${base.color} from ${base.sourceLabel}` +
      (branchColor ? ` with ${branchColor} for branch ${git.branch}` : ''),
  );
  return currentState;
}

export async function refreshAutomaticColor(): Promise<AutomaticColorState | undefined> {
  if (refreshInProgress) {
    await refreshInProgress;
    return refreshAutomaticColor();
  }

  refreshInProgress = performRefresh();
  try {
    return await refreshInProgress;
  } finally {
    refreshInProgress = undefined;
  }
}

export async function enableAutomaticColor() {
  await vscode.workspace
    .getConfiguration('peacock')
    .update(StandardSettings.AutoColorMode, 'auto', vscode.ConfigurationTarget.Workspace);
  return refreshAutomaticColor();
}

export async function disableAutomaticColor() {
  await vscode.workspace
    .getConfiguration('peacock')
    .update(StandardSettings.AutoColorMode, 'off', vscode.ConfigurationTarget.Workspace);
  return refreshAutomaticColor();
}

export async function initializeAutomaticColor(context: vscode.ExtensionContext) {
  await refreshAutomaticColor();
  await watchGitIdentity(context, () => {
    refreshAutomaticColor();
  });

  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  const configuredPatterns = [getProjectIconPath(), ...getProjectIconSearchPatterns()].filter(
    Boolean,
  );
  const patterns: vscode.GlobPattern[] = [
    '**/{favicon,icon,app-icon}.{ico,png,jpg,jpeg,svg}',
    ...(folder
      ? configuredPatterns.map(pattern => new vscode.RelativePattern(folder, pattern))
      : []),
  ];
  patterns.forEach(pattern => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    context.subscriptions.push(
      watcher,
      watcher.onDidCreate(() => refreshAutomaticColor()),
      watcher.onDidChange(() => refreshAutomaticColor()),
      watcher.onDidDelete(() => refreshAutomaticColor()),
    );
  });
}
