import * as vscode from 'vscode';
import { getEnvironmentGuardrails, getGitRemoteName } from './configuration';
import { getGitIdentity, watchGitState } from './automatic-color/git';
import { EnvironmentGuardrailTarget, IEnvironmentGuardrail, StandardSettings } from './models';

export interface EnvironmentIdentity {
  workspace: string[];
  remote: string[];
  branch: string[];
  gitRemote: string[];
}

export interface EnvironmentGuardrailMatch {
  rule: IEnvironmentGuardrail;
  target: Exclude<EnvironmentGuardrailTarget, 'any'>;
  value: string;
}

function escapeRegularExpression(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function environmentPatternMatches(pattern: string, value: string) {
  const expression = `^${escapeRegularExpression(pattern).replace(/\*/g, '.*')}$`;
  return new RegExp(expression, 'i').test(value);
}

export function resolveEnvironmentGuardrail(
  rules: IEnvironmentGuardrail[],
  identity: EnvironmentIdentity,
) {
  const targets: Exclude<EnvironmentGuardrailTarget, 'any'>[] = [
    'workspace',
    'remote',
    'branch',
    'gitRemote',
  ];
  for (const rule of rules) {
    if (!rule || !rule.name || !rule.pattern) {
      continue;
    }
    const selectedTargets = !rule.target || rule.target === 'any' ? targets : [rule.target];
    for (const target of selectedTargets) {
      const value = identity[target].find(candidate =>
        environmentPatternMatches(rule.pattern, candidate),
      );
      if (value) {
        return { rule, target, value } as EnvironmentGuardrailMatch;
      }
    }
  }
  return undefined;
}

let statusBarItem: vscode.StatusBarItem | undefined;
let refreshHandle: NodeJS.Timeout | undefined;

async function getEnvironmentIdentity(): Promise<EnvironmentIdentity> {
  const folders = vscode.workspace.workspaceFolders || [];
  const git = await getGitIdentity(getGitRemoteName());
  return {
    workspace: [
      vscode.workspace.name || '',
      ...folders.reduce<string[]>((values, folder) => {
        values.push(folder.name, folder.uri.fsPath);
        return values;
      }, []),
    ].filter(Boolean),
    remote: [vscode.env.remoteName || '', ...folders.map(folder => folder.uri.authority)].filter(
      Boolean,
    ),
    branch: [git.branch || ''].filter(Boolean),
    gitRemote: [git.normalizedRemote || '', git.remoteUrl || ''].filter(Boolean),
  };
}

async function refreshEnvironmentGuardrail() {
  if (!statusBarItem) {
    return;
  }
  const rules = getEnvironmentGuardrails();
  if (!rules.length) {
    statusBarItem.hide();
    return;
  }
  const match = resolveEnvironmentGuardrail(rules, await getEnvironmentIdentity());
  if (!match) {
    statusBarItem.hide();
    return;
  }
  const severity = match.rule.severity || 'warning';
  statusBarItem.text = `$(shield) ${match.rule.name}`;
  statusBarItem.backgroundColor = new vscode.ThemeColor(
    severity === 'error' ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground',
  );
  statusBarItem.tooltip = [
    `Better Peacock Environment Guardrail: ${match.rule.name}`,
    `Matched ${match.target}: ${match.value}`,
    `Rule: ${match.rule.pattern}`,
    'Click to edit Better Peacock settings',
  ].join('\n');
  statusBarItem.show();
}

function scheduleRefresh() {
  if (!getEnvironmentGuardrails().length) {
    if (statusBarItem) {
      statusBarItem.hide();
    }
    return;
  }
  if (refreshHandle) {
    clearTimeout(refreshHandle);
  }
  refreshHandle = setTimeout(() => refreshEnvironmentGuardrail(), 200);
}

export async function initializeEnvironmentGuardrails(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.name = 'Better Peacock Environment Guardrail';
  statusBarItem.command = {
    command: 'workbench.action.openSettings',
    title: 'Open Better Peacock Settings',
    arguments: ['@ext:chrismeehan20.better-peacock environmentGuardrails'],
  };
  context.subscriptions.push(
    statusBarItem,
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration(`peacock.${StandardSettings.EnvironmentGuardrails}`) ||
        event.affectsConfiguration(`peacock.${StandardSettings.GitRemoteName}`)
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
  await refreshEnvironmentGuardrail();
}
