import * as vscode from 'vscode';
import { getAgentBeaconEnabled } from '../configuration';
import { Logger } from '../logging';
import { StandardSettings } from '../models';
import {
  evaluateHookLiveness,
  forgetInstall,
  getHomeDirectory,
  hasCodexHookTrust,
  HookLiveness,
  readAgentActivity,
  readLivenessState,
  recordInstall,
  updateLivenessState,
} from './liveness';
import { resolveNodeExecutable } from './node-runtime';
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
  nodePath = 'node',
) {
  const result = removeAgentBeaconHooks(configuration);
  const escapedPath = helperPath.replace(/"/g, '\\"');
  // An absolute Node path keeps the hook working regardless of the PATH the
  // agent launched with, which is what version-manager installs get wrong.
  const escapedNode = nodePath.replace(/"/g, '\\"');
  const command = `"${escapedNode}" "${escapedPath}" ${provider}`;

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

export function providerDisplayName(provider: AgentBeaconProvider) {
  return provider === 'codex' ? 'Codex' : 'Claude Code';
}

/**
 * The two providers differ in what installation actually accomplishes. Claude
 * Code watches its settings file and picks new hooks up without a restart or any
 * approval. Codex records trust for hook definitions separately and silently
 * skips anything it has not been told to trust, so for Codex the remaining step
 * is stated as a required action rather than a footnote.
 */
async function reportInstallOutcome(home: string, providers: AgentBeaconProvider[]) {
  const names = providers.map(providerDisplayName).join(' and ');
  const codexNeedsTrust = providers.includes('codex') && !(await hasCodexHookTrust(home));

  if (!codexNeedsTrust) {
    const notes = [
      providers.includes('claude') ? 'Claude Code picks them up automatically.' : '',
      providers.includes('codex') ? 'Restart active Codex sessions to pick them up.' : '',
    ].filter(Boolean);
    await vscode.window.showInformationMessage(
      `Agent Beacon hooks written for ${names}. ${notes.join(' ')}`,
    );
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Agent Beacon hooks written for ${names}, but Codex will not run them yet. Codex trusts hook definitions separately: run /hooks in Codex and approve them, otherwise the Codex half of Agent Beacon stays silent.`,
    'Verify Hooks',
    'Open Documentation',
  );
  if (choice === 'Verify Hooks') {
    await verifyAgentBeaconHooks();
  } else if (choice === 'Open Documentation') {
    await vscode.commands.executeCommand('peacock.docs');
  }
}

function livenessSummary(liveness: HookLiveness, provider: AgentBeaconProvider) {
  const name = providerDisplayName(provider);
  switch (liveness) {
    case 'not-installed':
      return `$(circle-outline) ${name}: hooks not installed by Better Peacock.`;
    case 'live':
      return `$(pass-filled) ${name}: hooks are firing.`;
    case 'awaiting-first-event':
      return `$(clock) ${name}: hooks installed, waiting for the first event. Start a session to confirm.`;
    case 'silent':
      return `$(error) ${name}: ran since installation but sent no hook events.`;
  }
}

/**
 * Reports what is actually happening rather than what was configured, so a
 * silently untrusted hook set is visible instead of being mistaken for success.
 */
export async function verifyAgentBeaconHooks() {
  const home = getHomeDirectory();
  if (!home) {
    await vscode.window.showInformationMessage(
      'Agent Beacon verification is available in desktop VS Code only.',
    );
    return;
  }

  const state = readLivenessState();
  const providers: AgentBeaconProvider[] = ['codex', 'claude'];
  const lines: string[] = [];
  let remedy: 'codex-trust' | 'reinstall' | undefined;

  for (const provider of providers) {
    const activityAt = await readAgentActivity(home, provider);
    const liveness = evaluateHookLiveness(state, provider, activityAt);
    lines.push(livenessSummary(liveness, provider));

    if (liveness === 'silent') {
      remedy =
        provider === 'codex' && !(await hasCodexHookTrust(home)) ? 'codex-trust' : 'reinstall';
    }
  }

  const detail = lines.join('\n');
  if (!remedy) {
    await vscode.window.showInformationMessage('Agent Beacon status', { modal: true, detail });
    return;
  }

  const action = remedy === 'codex-trust' ? 'Show Codex Steps' : 'Reinstall Hooks';
  const choice = await vscode.window.showWarningMessage(
    'Agent Beacon status',
    {
      modal: true,
      detail,
    },
    action,
  );

  if (choice === 'Show Codex Steps') {
    await vscode.window.showInformationMessage('Trust Codex hooks', {
      modal: true,
      detail:
        'Codex has not recorded trust for these hook definitions, so it skips them.\n\n' +
        '1. Open Codex.\n' +
        '2. Run /hooks.\n' +
        '3. Review the Better Peacock entries and approve them.\n' +
        '4. Start a new Codex session, then run Verify Agent Beacon Hooks again.\n\n' +
        'Trust is tied to the hook definitions, so reinstalling hooks requires approving them again.',
    });
  } else if (choice === 'Reinstall Hooks') {
    await vscode.commands.executeCommand('peacock.installAgentBeacon');
  }
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

  // Resolved before the confirmation prompt so a missing runtime is reported as
  // a prerequisite rather than as a failure half-way through installing.
  const nodePath = await resolveNodeExecutable(process.env.PATH, process.platform, home);
  if (!nodePath) {
    const choice = await vscode.window.showErrorMessage(
      'Agent Beacon needs Node.js to run its hook helper, and no Node installation could be found. Install Node.js, then run this command again.',
      {
        modal: true,
        detail:
          'Codex and Claude Code run the helper themselves, so they cannot use the Node runtime bundled with VS Code.',
      },
      'Open nodejs.org',
    );
    if (choice === 'Open nodejs.org') {
      await vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org/'));
    }
    return;
  }

  const confirmation = await vscode.window.showWarningMessage(
    'Better Peacock will install a local state-only helper and merge lifecycle hooks into the selected agent configuration files. Existing files are backed up first.',
    { modal: true, detail: `Hook helper will run with: ${nodePath}` },
    'Install Hooks',
  );
  if (confirmation !== 'Install Hooks') {
    return;
  }

  try {
    const helper = await installHelper(context, home);
    const installedAt = Date.now();
    for (const item of selected) {
      const uri = providerConfigurationUri(home, item.provider);
      const existing = await readOptionalConfiguration(uri);
      const configuration = addAgentBeaconHooks(
        existing.configuration,
        item.provider,
        helper.fsPath,
        nodePath,
      );
      await writeConfiguration(uri, configuration, existing.exists);
      await updateLivenessState(state => recordInstall(state, item.provider, installedAt));
    }
    if (!getAgentBeaconEnabled()) {
      await vscode.workspace
        .getConfiguration('peacock')
        .update(StandardSettings.AgentBeaconEnabled, true, vscode.ConfigurationTarget.Global);
    }
    await reportInstallOutcome(
      home,
      selected.map(item => item.provider),
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
      await updateLivenessState(state => forgetInstall(state, provider));
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
