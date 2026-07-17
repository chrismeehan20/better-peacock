import * as vscode from 'vscode';
import { getAgentBeaconEnabled } from '../configuration';
import { Logger } from '../logging';
import { StandardSettings } from '../models';
import { AgentBeaconProvider, HookConfiguration, HookGroup, HookHandler } from './types';

const hookMarker = 'better-peacock/agent-beacon.cjs';

function cloneConfiguration(configuration: HookConfiguration): HookConfiguration {
  return JSON.parse(JSON.stringify(configuration || {}));
}

function withoutBeaconHandlers(groups: HookGroup[] | undefined) {
  return (Array.isArray(groups) ? groups : [])
    .map(group => ({
      ...group,
      hooks: (Array.isArray(group.hooks) ? group.hooks : []).filter(
        handler =>
          !String(handler.command || '')
            .replace(/\\/g, '/')
            .includes(hookMarker),
      ),
    }))
    .filter(group => group.hooks.length > 0);
}

export function removeAgentBeaconHooks(configuration: HookConfiguration) {
  const result = cloneConfiguration(configuration);
  if (!result.hooks || typeof result.hooks !== 'object') {
    return result;
  }
  Object.keys(result.hooks).forEach(event => {
    const groups = withoutBeaconHandlers(result.hooks && result.hooks[event]);
    if (groups.length) {
      result.hooks![event] = groups;
    } else {
      delete result.hooks![event];
    }
  });
  if (!Object.keys(result.hooks).length) {
    delete result.hooks;
  }
  return result;
}

function appendHook(
  configuration: HookConfiguration,
  event: string,
  command: string,
  matcher?: string,
) {
  if (!configuration.hooks) {
    configuration.hooks = {};
  }
  const handler: HookHandler = {
    type: 'command',
    command,
    timeout: 10,
    statusMessage: 'Updating Better Peacock Agent Beacon',
  };
  const group: HookGroup = { hooks: [handler] };
  if (matcher) {
    group.matcher = matcher;
  }
  configuration.hooks[event] = [...(configuration.hooks[event] || []), group];
}

export function addAgentBeaconHooks(
  configuration: HookConfiguration,
  provider: AgentBeaconProvider,
  helperPath: string,
) {
  const result = removeAgentBeaconHooks(configuration);
  const escapedPath = helperPath.replace(/"/g, '\\"');
  const command = `node "${escapedPath}" ${provider}`;

  appendHook(result, 'UserPromptSubmit', command);
  appendHook(result, 'PermissionRequest', command);
  appendHook(result, 'Stop', command);
  if (provider === 'claude') {
    appendHook(
      result,
      'Notification',
      command,
      'permission_prompt|idle_prompt|agent_needs_input|agent_completed',
    );
    appendHook(result, 'StopFailure', command);
  }
  return result;
}

function getHomeDirectory() {
  if (vscode.env.uiKind === vscode.UIKind.Web) {
    return undefined;
  }
  return process.env.HOME || process.env.USERPROFILE;
}

function encode(value: string) {
  return Uint8Array.from(Buffer.from(value, 'utf8'));
}

function decode(value: Uint8Array) {
  return Buffer.from(value).toString('utf8');
}

function isFileNotFound(error: unknown) {
  return /FileNotFound|ENOENT/i.test(String(error));
}

async function readOptionalConfiguration(uri: vscode.Uri) {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = decode(bytes);
    return { exists: true, configuration: JSON.parse(text) as HookConfiguration };
  } catch (error) {
    if (isFileNotFound(error)) {
      return { exists: false, configuration: {} as HookConfiguration };
    }
    throw error;
  }
}

async function writeConfiguration(
  uri: vscode.Uri,
  configuration: HookConfiguration,
  existed: boolean,
) {
  const parent = vscode.Uri.file(uri.fsPath.replace(/[\\/][^\\/]+$/, ''));
  await vscode.workspace.fs.createDirectory(parent);
  if (existed) {
    const backup = vscode.Uri.file(`${uri.fsPath}.better-peacock-backup-${Date.now()}`);
    await vscode.workspace.fs.copy(uri, backup, { overwrite: false });
  }
  const temporary = vscode.Uri.file(`${uri.fsPath}.better-peacock-tmp`);
  await vscode.workspace.fs.writeFile(
    temporary,
    encode(`${JSON.stringify(configuration, null, 2)}\n`),
  );
  await vscode.workspace.fs.rename(temporary, uri, { overwrite: true });
}

function providerConfigurationUri(home: string, provider: AgentBeaconProvider) {
  return vscode.Uri.file(
    provider === 'codex' ? `${home}/.codex/hooks.json` : `${home}/.claude/settings.json`,
  );
}

function helperUri(home: string) {
  return vscode.Uri.file(`${home}/.better-peacock/agent-beacon.cjs`);
}

async function installHelper(context: vscode.ExtensionContext, home: string) {
  const source = vscode.Uri.joinPath(context.extensionUri, 'resources', 'agent-beacon.cjs');
  const target = helperUri(home);
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(`${home}/.better-peacock`));
  await vscode.workspace.fs.copy(source, target, { overwrite: true });
  return target;
}

interface ProviderPick extends vscode.QuickPickItem {
  provider: AgentBeaconProvider;
}

export async function installAgentBeaconHooks(context: vscode.ExtensionContext) {
  const home = getHomeDirectory();
  if (!home) {
    await vscode.window.showInformationMessage(
      'Agent Beacon hook installation is available in desktop VS Code only.',
    );
    return;
  }

  const selected = await vscode.window.showQuickPick<ProviderPick>(
    [
      { label: 'Codex', description: '~/.codex/hooks.json', provider: 'codex', picked: true },
      {
        label: 'Claude Code',
        description: '~/.claude/settings.json',
        provider: 'claude',
        picked: true,
      },
    ],
    {
      canPickMany: true,
      placeHolder: 'Choose the local agents Better Peacock should monitor',
    },
  );
  if (!selected || !selected.length) {
    return;
  }

  const confirmation = await vscode.window.showWarningMessage(
    'Better Peacock will install a local state-only helper and merge lifecycle hooks into the selected agent configuration files. Existing files are backed up first.',
    { modal: true },
    'Install Hooks',
  );
  if (confirmation !== 'Install Hooks') {
    return;
  }

  try {
    const helper = await installHelper(context, home);
    for (const item of selected) {
      const uri = providerConfigurationUri(home, item.provider);
      const existing = await readOptionalConfiguration(uri);
      const configuration = addAgentBeaconHooks(
        existing.configuration,
        item.provider,
        helper.fsPath,
      );
      await writeConfiguration(uri, configuration, existing.exists);
    }
    if (!getAgentBeaconEnabled()) {
      await vscode.workspace
        .getConfiguration('peacock')
        .update(StandardSettings.AgentBeaconEnabled, true, vscode.ConfigurationTarget.Global);
    }
    await vscode.window.showInformationMessage(
      'Agent Beacon hooks installed. Restart active agent sessions. In Codex, use /hooks to review and trust the new hook definitions.',
    );
  } catch (error) {
    Logger.info(`Better Peacock: Agent Beacon installation failed: ${String(error)}`);
    await vscode.window.showErrorMessage(
      `Better Peacock could not install Agent Beacon hooks: ${String(error)}`,
    );
  }
}

export async function uninstallAgentBeaconHooks() {
  const home = getHomeDirectory();
  if (!home) {
    await vscode.window.showInformationMessage(
      'Agent Beacon hook removal is available in desktop VS Code only.',
    );
    return;
  }
  const confirmation = await vscode.window.showWarningMessage(
    'Remove Better Peacock hook handlers from Codex and Claude Code? Other hooks and settings will be preserved.',
    { modal: true },
    'Remove Hooks',
  );
  if (confirmation !== 'Remove Hooks') {
    return;
  }

  try {
    for (const provider of ['codex', 'claude'] as AgentBeaconProvider[]) {
      const uri = providerConfigurationUri(home, provider);
      const existing = await readOptionalConfiguration(uri);
      if (existing.exists) {
        await writeConfiguration(uri, removeAgentBeaconHooks(existing.configuration), true);
      }
    }
    try {
      await vscode.workspace.fs.delete(helperUri(home));
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }
    await vscode.workspace
      .getConfiguration('peacock')
      .update(StandardSettings.AgentBeaconEnabled, false, vscode.ConfigurationTarget.Global);
    await vscode.window.showInformationMessage('Agent Beacon hooks removed.');
  } catch (error) {
    Logger.info(`Better Peacock: Agent Beacon removal failed: ${String(error)}`);
    await vscode.window.showErrorMessage(
      `Better Peacock could not remove Agent Beacon hooks: ${String(error)}`,
    );
  }
}
