# Better Peacock for Visual Studio Code

## Overview

Automatically give each Visual Studio Code project, repository, and protected branch a recognizable color.

## Install

Package the extension with `npm run package`, install the generated VSIX, and disable the original Peacock extension before enabling Better Peacock.

## Quick Usage

Let's see Better Peacock in action!

1. Create/Open a VSCode Workspace ([Peacock only works in a Workspace](/guide/#peacock-commands-are-not-appearing))
1. Press `F1` to open the command palette
1. Type `Better Peacock`
1. Choose `Better Peacock: Change to a favorite color`
1. Choose one of the pre-defined colors and see how it changes your editor

Now enjoy exploring the rest of the features explained in the docs, here!

![Peacock Windows](../assets/peacock-windows.png 'Peacock Windows')

## Features

Commands can be found in the command palette. Look for commands beginning with "Better Peacock:"

- Change the color of [Affected Elements](#affected-elements) (see `peacock.affect*` in the [Settings](#settings) section) to
  - [user defined color](#input-formats)
  - a random color
- Select a user-defined color from your [Favorite Colors](#favorite-colors)
- Save a user-defined color with the [Save Favorite Color](#save-favorite-color)
- [Adjust the coloring of affected elements](#element-adjustments) by making them slightly darker or lighter to provide a subtle visual contrast between them
- Saves colors to your workspace in the `.vscode/settings.json` file
- Integrates with [Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare&wt.mc_id=vscodepeacock-github-jopapa).
- Integrates with [VS Code Remote](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack&wt.mc_id=vscodepeacock-github-jopapa).
- Can automatically derive stable colors from a project icon, Git remote, or workspace identity.
- Can warn when you switch to protected branches by overriding the status bar color.
- Uses a concise `Repository [VS Code]` native window title so projects are easier to identify in macOS Mission Control and other system window views.
- Can show supported Codex and Claude Code states and aggregate projects needing attention across VS Code windows.
- Shows compact Git risk while remaining hidden for clean repositories.
- Supports explicit environment warning rules without guessing which environments are sensitive.

## Settings

| Property                            | Description                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| peacock.affectActivityBar           | Specifies whether Peacock should affect the activity bar                                                            |
| peacock.affectStatusBar             | Specifies whether Peacock should affect the status bar                                                              |
| peacock.affectDebuggingStatusBar    | Specifies whether Peacock should affect the status bar while debugging. Defaults to false.                          |
| peacock.affectTitleBar              | Specifies whether Peacock should affect the title bar (see [title bar coloring](#title-bar-coloring))               |
| peacock.affectEditorGroupBorder     | Specifies whether Peacock should affect the editorGroup border. Defaults to false.                                  |
| peacock.affectPanelBorder           | Specifies whether Peacock should affect the panel border. Defaults to false.                                        |
| peacock.affectSideBarBorder         | Specifies whether Peacock should affect the sideBar border. Defaults to false.                                      |
| peacock.affectSashHover             | Specifies whether Peacock should affect the sash border. Defaults to true.                                          |
| peacock.affectStatusAndTitleBorders | Specifies whether Peacock should affect the status or title borders. Defaults to false.                             |
| peacock.affectTabActiveBorder       | Specifies whether Peacock should affect the active tab's border. Defaults to false                                  |
| peacock.elementAdjustments          | fine tune coloring of affected elements                                                                             |
| peacock.favoriteColors              | array of objects for color names and hex values                                                                     |
| peacock.keepForegroundColor         | Specifies whether Peacock should change affect colors                                                               |
| peacock.surpriseMeOnStartup         | Specifies whether Peacock apply a random color on startup                                                           |
| peacock.darkForeground              | override for the dark foreground                                                                                    |
| peacock.lightForeground             | override for the light foreground                                                                                   |
| peacock.darkenLightenPercentage     | the percentage to darken or lighten the color                                                                       |
| peacock.surpriseMeFromFavoritesOnly | Specifies whether Peacock should choose a random color from the favorites list or a purely random color             |
| peacock.showColorInStatusBar        | Show the Peacock color in the status bar                                                                            |
| peacock.remoteColor                 | The Peacock color that will be applied to remote workspaces                                                         |
| peacock.color                       | The Peacock color that will be applied to workspaces                                                                |
| peacock.vslsShareColor              | Peacock color for Live Share Color when acting as a Guest                                                           |
| peacock.vslsJoinColor               | Peacock color for Live Share color when acting as the Host                                                          |
| peacock.squigglyBeGone              | Easter Egg feature for FUN. Hides all error, warning, and info underlines. This setting has NO effect on your code. |
| peacock.autoColorMode               | Automatic source: off, auto, projectIcon, gitRemote, or workspace                                                   |
| peacock.autoColorPriority           | Ordered source fallback used by auto mode                                                                           |
| peacock.gitRemoteName               | Git remote to normalize and hash; defaults to origin                                                                |
| peacock.projectIconPath             | Optional workspace-relative icon path                                                                               |
| peacock.projectIconSearchPatterns   | Ordered icon and favicon glob patterns                                                                              |
| peacock.projectIconPaletteStrategy  | dominant, vibrant, muted, or pastel image treatment                                                                 |
| peacock.branchColors                | Exact branch names or glob patterns mapped to warning colors                                                        |
| peacock.colorBranchStatusItem       | Shows the branch with a deterministic foreground color in Peacock's status item                                     |
| peacock.agentBeaconEnabled          | Enables local, hook-driven Codex and Claude Code status monitoring                                                   |
| peacock.agentBeaconNotifications    | Notifies once for background input, ready, and failed transitions                                                    |
| peacock.agentBeaconPollInterval     | Local Agent Beacon state check interval in milliseconds                                                             |
| peacock.agentBeaconStaleMinutes     | Removes old states from the Attention Queue                                                                          |
| peacock.gitRiskEnabled              | Shows conflicts, dirty files, and ahead/behind risk; hidden when clean                                               |
| peacock.gitRiskAheadBehindThreshold | Minimum ahead or behind count shown                                                                                   |
| peacock.environmentGuardrails       | Explicit glob rules for workspace, remote, branch, or Git-remote warnings                                            |

### Automatic Colors

Automatic colors are opt-in and never replace an explicit `peacock.color` or `peacock.remoteColor`. Run **Better Peacock: Enable Automatic Workspace Color**, or set `peacock.autoColorMode` in workspace settings.

With `auto` mode, Peacock tries these sources in `peacock.autoColorPriority` order:

1. **Project icon** — extracts the dominant color from PNG, JPEG, SVG, or ICO files and can make it vibrant, muted, or pastel.
2. **Git remote** — normalizes HTTPS, SSH, and scp-like remote URLs before hashing, so clones of the same repository receive the same color.
3. **Workspace identity** — hashes the workspace file or sorted workspace-folder URIs, including remote URI authorities.

The color is deterministic: reopening the same project produces the same result. Peacock watches icon files, Git repositories, remotes, and branch changes and refreshes without a window reload.

### Protected Branch Colors

Use `peacock.branchColors` for a full status-bar warning on protected or otherwise important branches. Exact names take priority over `*` glob patterns.

```json
{
  "peacock.branchColors": {
    "main": "#d73a49",
    "develop": "#fb8c00",
    "release/*": "#8e44ad"
  }
}
```

The branch warning changes only the status bar; the project color remains on the title and activity bars. The status item also displays the current branch and can use a deterministic branch foreground color.

### Agent Beacon

#### Requirements and limitations

| Requirement | Why |
| --- | --- |
| Desktop VS Code | The hook files live in your home directory; the web build has no access to it. |
| Node.js installed locally | The helper is a Node script that Codex and Claude Code execute themselves, so VS Code's bundled runtime is not available to them. |

Installation resolves an **absolute** path to a Node executable — searching `PATH` first, then common install directories, then nvm/fnm/volta version directories — and bakes it into the hook command. That keeps hooks working regardless of the environment the agent launched with, which is the usual reason version-manager installs fail. If no Node executable can be found, installation stops and says so instead of writing a hook that cannot run.

Two known limitations:

- **Remote development.** Hooks and beacon state live on whichever machine the agent runs on. If the agent runs in a container, WSL, or over SSH while the extension runs elsewhere, they will not see each other.
- **Claude Code version.** The `agent_needs_input` and `agent_completed` notification matchers require Claude Code 2.1.198 or later. On older versions those two states simply never arrive; the rest still works.

#### Installing

The guided path is the **Track your background agents** walkthrough on VS Code's Getting Started page, which sequences installation, the Codex trust step, and verification, and marks each step complete as it happens.

Run **Better Peacock: Install Agent Beacon Hooks** and choose Codex, Claude Code, or both. The command:

1. asks for explicit confirmation;
2. installs a small state-only helper under `~/.better-peacock`;
3. backs up an existing `~/.codex/hooks.json` or `~/.claude/settings.json`;
4. merges handlers for supported prompt, permission, notification, stop, and failure events; and
5. enables `peacock.agentBeaconEnabled` globally.

The helper records only the provider, lifecycle state, workspace path, event name, session ID, optional notification message, and timestamp. It never reads conversation transcripts or project files. Hook errors exit successfully so Agent Beacon cannot block an agent turn.

Use **Better Peacock: Uninstall Agent Beacon Hooks** to surgically remove Better Peacock handlers while preserving other hooks and settings.

#### What each agent needs after installation

| | Claude Code | Codex |
| --- | --- | --- |
| Approval step | None | **Run `/hooks` and approve the entries** |
| Picking up new hooks | Automatic — it watches the settings file | Restart the session |

**Claude Code requires nothing extra.** Hooks in `~/.claude/settings.json` run without any trust prompt at any scope, and its file watcher picks up changes mid-session. (Enterprise administrators can restrict hooks with the `allowManagedHooksOnly` policy, which would block this.)

**Codex requires approval.** Writing `~/.codex/hooks.json` is not sufficient on its own: Codex records trust for hook definitions separately from the definitions themselves, and silently ignores any hook it has not been told to trust — so hooks can be present and correct while never running once. Because trust is keyed to the hook definitions, reinstalling or changing hooks invalidates it and requires approving them again.

#### Verifying that hooks actually fire

**Better Peacock: Verify Agent Beacon Hooks** reports observed behaviour rather than configuration. For each provider it distinguishes:

| Result | Meaning |
| --- | --- |
| hooks not installed | Better Peacock has not written hooks for this provider. |
| waiting for the first event | Installed, but the agent has not run since — nothing to conclude yet. |
| hooks are firing | Hook events have arrived since installation. |
| ran without sending events | The agent demonstrably ran after installation and produced no events. Something is wrong; for Codex this is almost always missing trust. |

Better Peacock also warns once per provider on its own when it reaches that last state, so a silently untrusted hook set surfaces instead of being mistaken for a working one. The check compares hook-event history against the agent's own session files, so it never guesses from elapsed time alone.

### Attention Queue

The **Agent Attention Queue** view appears in the Explorer sidebar whenever `peacock.agentBeaconEnabled` is on, listing every project reporting agent state in any window. **Better Peacock: Show Attention Queue** opens the same information as a quick-pick for keyboard-driven use, and summarizes running agents when nothing needs attention. Both read the shared local state directory, and selecting a project opens it in a new VS Code window unless the current window already holds it.

### Git Risk

Git Risk is enabled by default but remains hidden when the repository is clean. Its compact status item can show:

- conflicts with an accessible error background;
- staged and unstaged change counts;
- unpushed commits (`↑`); and
- commits behind upstream (`↓`).

Click the item to open Source Control. Use `peacock.gitRiskAheadBehindThreshold` to suppress insignificant ahead or behind counts.

### Environment Guardrails

Environment Guardrails are intentionally empty by default. Better Peacock does not guess that a branch, SSH host, or workspace is production. Add explicit case-insensitive glob rules when your workflow benefits from a persistent warning:

```json
{
  "peacock.environmentGuardrails": [
    {
      "name": "Production",
      "pattern": "*production*",
      "target": "remote",
      "severity": "error"
    },
    {
      "name": "Release Branch",
      "pattern": "release/*",
      "target": "branch",
      "severity": "warning"
    }
  ]
}
```

Targets can be `any`, `workspace`, `remote`, `branch`, or `gitRemote`. A matching rule adds a short shield item without changing the durable repository color.

### Favorite Colors

After setting 1 or more colors (hex or named) in the user setting for `peacock.favoriteColors`, you can select **Better Peacock: Change to a Favorite Color** and you will be prompted with the list from `peacock.favoriteColors` from user settings.

```text
Gatsby Purple -> #123456
Auth0 Orange -> #eb5424
Azure Blue -> #007fff
```

Favorite colors require a user-defined name (`name`) and a value ( `value` ), as shown in the example below.

```javascript
  "peacock.favoriteColors": [
    { "name": "Gatsby Purple", "value": "#639" },
    { "name": "Auth0 Orange", "value": "#eb5424" },
    { "name": "Azure Blue", "value": "#007fff" }
  ]
```

> You can find brand color hex codes from <https://brandcolors.net>

#### Preview Your Favorite

When opening the Favorites command in the command palette, Peacock now previews (applies) the color as you cycle through them. If you cancel (press ESC), your colors revert to what you had prior to trying the Favorites command

![favorites](../assets/named-colors.gif)

#### Save Favorite Color

When you apply a color you enjoy, you can go to the workspace `settings.json` and copy the color's hex code, then create your own favorite color in your user `settings.json`. This involves a few manual steps and arguably is not obvious at first.

The `Better Peacock: Save Current Color as Favorite Color` feature allows you to save the currently set color as a favorite color, and prompts you to name it.

### Affected Elements

You can tell peacock which parts of VS Code will be affected by when you select a color. You can do this by checking the appropriate setting that applies to the elements you want to be colored. These include examples such as affectEditorGroupBorder, affectPanelBorder, affectSideBarBorder, affectSashHover.

Peacock also automatically colorizes the Command Center foreground and border to match the title bar when title bar coloring is enabled.

![affected elements](../assets/affected-settings.png)

### Element Adjustments

You can fine tune the coloring of affected elements by making them slightly darker or lighter to provide a subtle visual contrast between them. Options for adjusting elements are:

- `"darken"`: reduces the value of the selected color to make it slightly darker
- `"lighten"`: increases the value of the selected color to make it slightly lighter
- `"none"`: no adjustment will be made to the selected color

An example of using this might be to make the Activity Bar slightly lighter than the Status Bar and Title Bar to better visually distinguish it as present in several popular themes. This can be achieved with the setting in the example below.

```javascript
  "peacock.affectActivityBar": true,
  "peacock.affectStatusBar": true,
  "peacock.affectTitleBar": true,
  "peacock.elementAdjustments": {
    "activityBar": "lighten"
  }
```

This results in the Activity Bar being slightly lighter than the Status Bar and Title Bar (see below).

![Element Adjustments](../assets/element-adjustments.png)

### Keep Foreground Color

Recommended to remain `false` (the default value).

When set to true Peacock will not colorize the foreground of any of the affected elements and will only alter the background. Some users may desire this if their theme's foreground is their preference over Peacock. In this case, when set to true, the foreground will not be affected.

### Surprise Me On Startup

Recommended to remain `false` (the default value).

When set to true Peacock will automatically apply a random color when opening a workspace that does not define color customizations. This can be useful if you frequently open many instances of VS Code and you are interested in identifying them, but are not overly committed to the specific color applied.

If this setting is `true` and there is no peacock color set, then Peacock will choose a new color. If there is already a color set, Peacock will not choose a random color as this would prevent users from choosing a specific color for some workspaces and surprise in others.

### Lighten and Darken

You may like a color but want to lighten or darken it. You can do this through the corresponding [commands](#commands). When you choose one of these commands the current color will be lightened or darkened by the percentage that is in the `darkenLightenPercentage` setting. You may change this setting to be a value between 1 and 10 percent.

There are key bindings for the lighten command `alt+cmd+=` and for darken command `alt+cmd+-`, to make it easier to adjust the colors.

## Commands

| Command                                         | Description                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Better Peacock: Reset Workspace Colors                 | Removes any of the color settings from the `.vscode/settings.json` file. If colors exist in the user settings, they may be applied |
| Better Peacock: Remove All Global and Workspace Colors | Removes all of the color settings from both the Workspace `.vscode/settings.json` file and the Global user `settings.json` file.   |
| Better Peacock: Enter a Color                          | Prompts you to enter a color (see [input formats](#input-formats))                                                                 |
| Better Peacock: Color to Peacock Green                 | Sets the color to Peacock main color, #42b883                                                                                      |
| Better Peacock: Surprise me with a Random Color        | Sets the color to a random color                                                                                                   |
| Better Peacock: Change to a Favorite Color             | Prompts user to select from their Favorites                                                                                        |
| Better Peacock: Save Current Color to Favorites        | Save Current Color to their Favorites                                                                                              |
| Better Peacock: Add Recommended Favorites              | Add the recommended favorites to user settings (override same names)                                                               |
| Better Peacock: Darken                                 | Darkens the current color by `darkenLightenPercentage`                                                                             |
| Better Peacock: Lighten                                | Lightens the current color by `darkenLightenPercentage`                                                                            |
| Better Peacock: Show and Copy Current Color            | Shows the current color and copies it to the clipboard                                                                             |
| Better Peacock: Show the Documentation                 | Opens the Peacock documentation web site in a browser                                                                              |
| Better Peacock: Enable Automatic Workspace Color       | Enables automatic source fallback in this workspace                                                                                |
| Better Peacock: Disable Automatic Workspace Color      | Disables automatic source fallback in this workspace                                                                               |
| Better Peacock: Refresh Automatic Workspace Color      | Re-runs icon, Git remote, workspace, and protected-branch detection                                                                |
| Better Peacock: Install Agent Beacon Hooks              | Backs up and merges supported Codex and Claude Code lifecycle hooks                                                                |
| Better Peacock: Uninstall Agent Beacon Hooks            | Removes Better Peacock hook handlers while preserving other configuration                                                         |
| Better Peacock: Verify Agent Beacon Hooks               | Reports whether each agent's hooks are actually firing, and how to fix them when they are not                                       |
| Better Peacock: Show Attention Queue                    | Lists projects whose supported coding agent needs attention or is ready                                                            |

## Keyboard Shortcuts

| description                     | key binding | command                     |
| ------------------------------- | ----------- | --------------------------- |
| Darken the colors               | alt+cmd+-   | peacock.darken              |
| Lighten the colors              | alt+cmd+=   | peacock.lighten             |
| Surprise Me with a Random Color | cmd+shift+k | peacock.changeColorToRandom |

## Integrations

Peacock integrates with other extensions, as described in this section.

### VS Live Share Integration

![live share](../assets/peacock-live-share-demo.gif)

Peacock detects when the [Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare&wt.mc_id=vscodepeacock-github-jopapa) extension is installed and automatically adds two commands that allow the user to change color of their Live Share sessions as a Host or a Guest, depending on their role.

| Command                                  | Description                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Better Peacock: Change Live Share Color (Host)  | Prompts user to select a color for Live Share Host session from the Favorites  |
| Better Peacock: Change Live Share Color (Guest) | Prompts user to select a color for Live Share Guest session from the Favorites |

When a [Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare&wt.mc_id=vscodepeacock-github-jopapa) session is started, the selected workspace color will be applied. When the session is finished, the workspace color is reverted back to the previous one (if set).

- Learn more about [Live Share](https://code.visualstudio.com/blogs/2017/11/15/live-share?wt.mc_id=vscodepeacock-github-jopapa)
- Get the [Live Share extension](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare&wt.mc_id=vscodepeacock-github-jopapa)
- Get the [Live Share extension pack](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare-pack&wt.mc_id=vscodepeacock-github-jopapa), which now includes Peacock

### Remote Development Integration

Peacock integrates with the Remote Development features of VS Code.

- Learn more about [VS Code Remote Development](https://code.visualstudio.com/blogs/2019/05/02/remote-development?wt.mc_id=vscodepeacock-github-jopapa)
- Get the [VS Code Remote Development Extensions](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack&wt.mc_id=vscodepeacock-github-jopapa)

Peacock detects when the [VS Code Remote](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) extension is installed and adds commands that allow the user to change color when in a remote context. All remote contexts share the same color (wsl, ssh, containers).

When a workspace is opened in a remote context, if a `peacock.remoteColor` is set, it will be applied. Otherwise, the regular `peacock.color` is applied.

![Remote Integration with Peacock](../assets/peacock-remote.gif)

VS Code distinguishes two classes of extensions: UI Extensions and Workspace Extensions. Peacock is classified as a UI extension as it makes contributions to the VS Code user interface and is always run on the user's local machine. UI Extensions cannot directly access files in the workspace, or run scripts/tools installed in that workspace or on the machine. Example UI Extensions include: themes, snippets, language grammars, and keymaps.

In version 2.1.2 Peacock enabled integration with the Remote Development by adding `"extensionKind": "ui"` in the extension's `package.json`.

## Input Formats

When entering a color in Peacock several formats are acceptable. These include

| Format            | Examples                                         |
| ----------------- | ------------------------------------------------ |
| Named HTML colors | purple, blanchedalmond                           |
| Short Hex         | #8b2, f00                                        |
| Short Hex8 (RGBA) | #8b2c, f00c                                      |
| Hex               | #88bb22, ff0000                                  |
| Hex8 (RGBA)       | #88bb22cc, ff0000cc                              |
| RGB               | rgb (136, 187, 34), rgb 255 0 0                  |
| RGBA              | rgba (136, 187, 34, .8), rgba 255 0 0 .8         |
| HSL               | hsl (80, 69%, 43%), hsl (0 1 .5)                 |
| HSLA              | hsla (80, 69%, 43%, 0.8), hsla (0 1 .5 .8)       |
| HSV               | hsv (80, 82%, 73%), hsv (0 1 1)                  |
| HSVA              | hsva (80, 82%, 73%, 0.8), hsva (0,100%,100%,0.8) |

All formats offer flexible data validation:

- For named HTML colors, case is insensitive
- For any hex value, the `#` is optional.
- For any color formula value all parentheses and commas are optional and any number can be a decimal or percentage (with the exception of the alpha channel in rgba(), hsla(), and hsva() which must be a decimal between 0 and 1).

### Alpha Support

Peacock allows for control of the alpha channel through a variety of input formats listed above. In general, it is recommended to avoid using transparent colors because it may result in poor readability. This is due to elements being affected by Peacock rendering over the VS Code workbench which will have either a light or a dark background based on the current theme. At the current time, extensions within VS Code do not have access to information about the current workbench color which will impact the readability calculations that Peacock performs to select various element colors based on the entered color. See [#293](https://github.com/johnpapa/vscode-peacock/issues/293#issuecomment-548968718) for more information.

## Roadmap

There are many features in the roadmap.

### Issues

Please refer to the [issues list and feel free to grab one and contribute](https://github.com/johnpapa/vscode-peacock/issues)!

### Contributions

See these pages for details on [contributions](/about/contributing) and our [code of conduct](/about/code_of_conduct).

### Logging

Peacock writes to VS Code's log output. You can open the output panel and select "Peacock" to see the log. This can be helpful when reporting issues.

## Changes

See the [CHANGELOG](/changelog) latest changes.

## FAQ

### Peacock commands are not appearing

Peacock only works if a workspace is open in Visual Studio Code because it needs the settings.json file to work. When it is not in a workspace, all commands are hidden and disabled except for the "Better Peacock: Open Documentation" command.

### What does Peacock affect

Peacock affects:

- the titlebar, activitybar, and statusbar elements
- anything regarding the readability of these elements
- background and foreground colors
- any elements that are displayed within these peacock elements (e.g. badges, hover)

### What happens when you change the user settings

When any Peacock setting is changed, Peacock should update the colors appropriately based on the most recently used color during the active VS Code instance's session.

#### Example 1

User selects a color, then later changes which elements are affected.

1. User chooses "surprise me" and sets the color to #ff0000
1. Peacock saves #ff0000 in memory as the most recently used color
1. User goes to settings and unchecks the "Better Peacock: Affect StatusBar"
1. Peacock listens to this change, clears all colors and reapplies the #ff0000

#### Example 2

User opens VS Code, already has colors in their workspace, and immediately changes which elements are affected.

1. User opens VS Code
1. Workspace colors are set to #369
1. User goes to settings and unchecks the "Better Peacock: Affect StatusBar"
1. Peacock listens to this change, clears all colors and reapplies the #369

#### Example 3

User opens VS Code, has no colors in workspace, and immediately changes which elements are affected.

1. User opens VS Code
1. No workspace colors are set
1. Peacock's most recently used color is not set
1. User goes to settings and unchecks the "Better Peacock: Affect StatusBar"
1. Peacock listens to this change, however no colors are applied

### How does title bar coloring work

Peacock contributes `${rootName} [VS Code]` as VS Code's default native window title. This makes Mission Control's hover label concise and project-focused. A user, remote, workspace, or folder value for VS Code's `window.title` setting takes precedence, so Peacock never writes over an explicit title preference. Removing Peacock also removes its contributed default.

The VS Code Title Bar style can be configured to be custom or native with the `window.titleBarStyle` setting. When operating in native mode, Peacock is unable to colorize the Title Bar because VS Code defers Title Bar management to the OS. In order to leverage the Affect Title Bar setting to colorize the Title Bar, the `window.titleBarStyle` must be set to custom.

On macOS there are additional settings that can impact the Title Bar style and force it into native mode regardless of the `window.titleBarStyle` setting. These include:

- `window.nativeTabs` should be set to **false**. If using native tabs, the rendering of the title bar is deferred to the OS and native mode is forced.
- `window.nativeFullScreen` should be set to **true**. If not using native full screen mode, the custom title bar rendering presents issues in the OS and native mode is forced.

A successful and recommended settings configuration to colorize the Title Bar is:

![Title Bar Settings](../assets/title-bar-coloring-settings.png)

### How are foreground colors calculated

Peacock is using tinycolor which provides some basic color theory mechanisms to determine whether or not to show a light or dark foreground color based on the perceived brightness of the background. More or less, if it thinks the background is darker than 50% then Peacock uses the light foreground. If it thinks the background is greater than 50% then Peacock uses the dark foreground.

Brightness is measured on a scale of 0-255 where a value of 127.5 is perfectly 50%.

Example:

```javascript
const lightForeground = '#e7e7e7';
const darkForegound = '#15202b';
const background = '#498aff';

const perceivedBrightness = tinycolor(background).getBrightness(); // 131.903, so 51.7%
const isDark = tinycolor(background).isDark(); // false, since brightness is above 50%
const textColor = isDark ? lightForeground : darkForeground; // We end up using dark text
```

This particular color (`#498aff`) is very near 50% on the perceived brightness, but the determination is binary so the color is either light or dark based on which side of 50% it is (exactly 50% is considered as light by the library). For the particular color `#498aff`, all of the theory aspects that tinycolor provides show that using the dark foreground is the right approach.

```javascript
const readability = tinycolor.readability(darkForeground, background); // 4.996713
const isReadable = tinycolor.isReadable(darkForeground, background); // true
```

The readability calculations and metrics are based on Web Content Accessibility Guidelines (Version 2.0) and, in general, a ratio close to 5 is considered good based on that information. If we run the lightForeground through the same algorithm you can see that readability actually suffers with a reduced contrast ratio:

```javascript
const readability = tinycolor.readability(lightForeground, background); // 2.669008
const isReadable = tinycolor.isReadable(lightForeground, background); // false
```

### Why is the foreground hard to see with my transparent color

The readability calculations that Peacock uses to determine an appropriate foreground color are based only on the color information of the entered background color. The alpha component is currently ignored in these calculations because of complications with VS Code that make it difficult to determine the actual background color of the affected elements. See [Alpha Support](#alpha-support) for more information.

### Why are my affected elements not transparent

Peacock allows you to enter colors that can be transparent, but the VS Code window itself is not transparent. If the entered color has some level of transparency, the resulting color of the affected elements will be based on the transparent color overlaying the default color of the VS Code workbench. In light themes the VS Code workbench color will be a very light gray and in dark themes a very dark gray.

### What are recommended favorites

Recommended favorites are a list of constants found in `favorites.ts`. These are alphabetized.

Recommended favorites are a starting point for favorites. They will be installed whenever a new version is installed. They will extend your existing favorites, so feel free to continue to add to your local favorites! However be careful not to change the color of the recommended favorites as they will be overridden when a new version is installed.

This list may change from version to version depending on the Peacock authoring team.

### What are mementos

Peacock takes advantage of a memento (a value stored between sessions and not in settings).

| Name                             | Type   | Description                                                                                                |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| peacockMementos.favoritesVersion | Global | The version of Peacock. Helps identify when the list of favorites should be written to the user's settings |

## Try the Code

If you want to try the extension out start by cloning this repo, `cd` into the folder, and then run `npm install`.

Then you can run the debugger for the launch configuration `Run Extension`. Set breakpoints, step through the code, and enjoy!

## Badges

[![CI](https://github.com/chrismeehan20/better-peacock/actions/workflows/ci.yml/badge.svg)](https://github.com/chrismeehan20/better-peacock/actions/workflows/ci.yml)
[![Live Share](https://img.shields.io/badge/Live_Share-enabled-8F80CF.svg?color=blue&style=flat-square&logo=visual-studio-code)](https://visualstudio.microsoft.com/services/live-share/?wt.mc_id=vscodepeacock-github-jopapa)

[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=blue&style=flat-square)](http://opensource.org/licenses/MIT)
[![All Contributors](https://img.shields.io/badge/all_contributors-15-blue.svg?style=flat-square)](#contributors)

## Resources

- [Get VS Code](https://code.visualstudio.com/?wt.mc_id=peacock-github-jopapa)
- [Create your first VS Code extension](https://code.visualstudio.com/api/get-started/your-first-extension?wt.mc_id=peacock-github-jopapa)
- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api?wt.mc_id=peacock-github-jopapa)
- [Learn how to add WebPack bundles to your favorite extensions](https://code.visualstudio.com/updates/v1_32#_bundling-extensions-with-webpack?wt.mc_id=peacock-github-jopapa)

![Sketchnote](../assets/peacock-sketchnote.png)
