// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
  Commands,
  State,
  StandardSettings,
  extensionShortName,
  getExtensionVersion,
} from './models';
import {
  resetWorkspaceColorsHandler,
  enterColorHandler,
  changeColorToRandomHandler,
  changeColorToPeacockGreenHandler,
  changeColorToFavoriteHandler,
  saveColorToFavoritesHandler,
  addRecommendedFavoritesHandler,
  darkenHandler,
  lightenHandler,
  showAndCopyCurrentColorHandler,
  removeAllPeacockColorsHandler,
  showDocumentationHandler,
} from './commands';
import {
  checkIfPeacockSettingsChanged,
  getSurpriseMeOnStartup,
  writeRecommendedFavoriteColors,
  getEnvironmentAwareColor,
  getFavoriteColors,
} from './configuration';
import { Logger } from './logging';
import { addLiveShareIntegration } from './live-share';
import { addRemoteIntegration } from './remote';
import { saveFavoritesVersionGlobalMemento, getMementos } from './mementos';
import {
  disableAutomaticColor,
  enableAutomaticColor,
  initializeAutomaticColor,
  refreshAutomaticColor,
} from './automatic-color';
import { initializeAgentBeacon } from './agent-beacon';
import { initializeEnvironmentGuardrails } from './environment-guardrails';
import { initializeGitRisk } from './git-risk';

const { commands, workspace } = vscode;

export async function activate(context: vscode.ExtensionContext) {
  State.extensionContext = context;
  // Logger.info(`${extensionShortName}: Extension "better-peacock" is now active!`);
  Logger.info(getMementos(), true, 'Better Peacock Mementos');

  registerCommands();
  initializeAgentBeacon(context);
  await initializeTheStarterSetOfFavorites();

  if (workspace.workspaceFolders) {
    Logger.info('Better Peacock is in a workspace, so its functionality is available.');
    /**
     * We only run this logic if we are in a workspace
     * because they may write peacock settings, and it will fail.
     * This entire function will re-run when a workspace is opened.
     */
    await checkSurpriseMeOnStartupLogic();
    await addRemoteIntegration(State.extensionContext);
    await initializeAutomaticColor(State.extensionContext);
    await initializeGitRisk(State.extensionContext);
    await initializeEnvironmentGuardrails(State.extensionContext);
    await addLiveShareIntegration(State.extensionContext);
  } else {
    Logger.info('Better Peacock is not in a workspace, so its functionality is unavailable.');
  }

  addSubscriptions(); // add these AFTER applying initial config
}

function addSubscriptions() {
  State.extensionContext.subscriptions.push(Logger.getChannel());

  State.extensionContext.subscriptions.push(workspace.onDidChangeConfiguration(applyPeacock()));
}

function applyPeacock(): (e: vscode.ConfigurationChangeEvent) => any {
  return async e => {
    const color = getEnvironmentAwareColor();
    if (checkIfPeacockSettingsChanged(e)) {
      Logger.info(
        `${extensionShortName}: Configuration changed. Refreshing manual and automatic colors: ${color}`,
      );
      await refreshAutomaticColor();
    }
  };
}

function registerCommands() {
  commands.registerCommand(Commands.showDocumentation, showDocumentationHandler);
  commands.registerCommand(Commands.resetWorkspaceColors, resetWorkspaceColorsHandler);
  commands.registerCommand(Commands.removeAllColors, removeAllPeacockColorsHandler);
  commands.registerCommand(Commands.saveColorToFavorites, saveColorToFavoritesHandler);
  commands.registerCommand(Commands.enterColor, enterColorHandler);
  commands.registerCommand(Commands.changeColorToRandom, changeColorToRandomHandler);
  commands.registerCommand(Commands.addRecommendedFavorites, addRecommendedFavoritesHandler);
  commands.registerCommand(Commands.changeColorToPeacockGreen, changeColorToPeacockGreenHandler);
  commands.registerCommand(Commands.changeColorToFavorite, changeColorToFavoriteHandler);
  commands.registerCommand(Commands.darken, darkenHandler);
  commands.registerCommand(Commands.lighten, lightenHandler);
  commands.registerCommand(Commands.showAndCopyCurrentColor, showAndCopyCurrentColorHandler);
  commands.registerCommand(Commands.refreshAutomaticColor, async () => {
    const state = await refreshAutomaticColor();
    const message = state
      ? `Better Peacock applied ${state.color} from ${state.sourceLabel}.`
      : 'Better Peacock did not find an enabled automatic color source.';
    await vscode.window.showInformationMessage(message);
  });
  commands.registerCommand(Commands.enableAutomaticColor, async () => {
    const state = await enableAutomaticColor();
    const message = state
      ? `Automatic colors enabled: ${state.color} from ${state.sourceLabel}.`
      : 'Automatic colors are enabled, but no source was found.';
    await vscode.window.showInformationMessage(message);
  });
  commands.registerCommand(Commands.disableAutomaticColor, async () => {
    await disableAutomaticColor();
    await vscode.window.showInformationMessage(
      'Automatic Better Peacock colors are disabled here.',
    );
  });
}

export function deactivate() {
  // Logger.info(`${extensionShortName}: Extension "better-peacock" is now deactive`);
}

async function initializeTheStarterSetOfFavorites() {
  // If the version has changed, we write the current set of favorites to user settings.json,
  // merging them with any the user has created on their own
  const currentVersion = getExtensionVersion();
  // TODO: Revisit how we merge favorites
  // For now we'll just add the starter set of favorites one time.
  // If there are favorites, do not write new ones.
  // We'll revisit this later so we do not overwrite favorites.
  const { values: favoritesValues } = getFavoriteColors();
  if (!favoritesValues.length) {
    await writeRecommendedFavoriteColors();
    await saveFavoritesVersionGlobalMemento(currentVersion);
  }
}

export async function checkSurpriseMeOnStartupLogic() {
  /**
   * If the "surprise me on startup" setting is true
   * and there is no peacock color set, then choose a new random color.
   * We do not choose a random color if there is already a color set
   * as this would confuse users who choose a specific color in a
   * workspace and see it changed to the "surprise" color
   */
  const peacockColor = getEnvironmentAwareColor();
  if (getSurpriseMeOnStartup()) {
    if (peacockColor) {
      const message = `Better Peacock did not change the color using "surprise me on startup" because the color ${peacockColor} was already set.`;
      Logger.info(message);
      return;
    }

    await changeColorToRandomHandler();
    const color = getEnvironmentAwareColor();
    const message = `Better Peacock changed the color to ${color}, because the setting is enabled for ${StandardSettings.SurpriseMeOnStartup}`;
    Logger.info(message);
  }
}
