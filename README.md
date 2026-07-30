# Better Peacock for Visual Studio Code

![Better Peacock Icon](resources/peacock-icon-small.png 'Better Peacock')

Automatically give each Visual Studio Code project, repository, and protected branch a recognizable color. Better Peacock makes it easier to identify the right editor window before you edit, commit, or push.

[![Live Share](https://img.shields.io/badge/Live_Share-enabled-8F80CF.svg?color=2f99fa&style=flat&logo=visual-studio-code)](https://visualstudio.microsoft.com/services/live-share/?WT.mc_id=academic-0000-jopapa)

[![AI Ready](https://img.shields.io/badge/AI--Ready-yes-brightgreen?style=flat)](https://github.com/johnpapa/ai-ready)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=2f99fa&style=flat)](http://opensource.org/licenses/MIT)
[![All Contributors](https://img.shields.io/badge/all_contributors-15-blue.svg?style=flat)](#contributors)

[![CI](https://github.com/chrismeehan20/better-peacock/actions/workflows/ci.yml/badge.svg)](https://github.com/chrismeehan20/better-peacock/actions/workflows/ci.yml)

Better Peacock is an MIT-licensed fork of [Peacock](https://github.com/johnpapa/vscode-peacock), created by John Papa. It preserves the existing `peacock.*` settings and command IDs so current workspace configuration remains compatible.

## Install

Until Better Peacock is published in the VS Code Marketplace, install a locally packaged VSIX:

```bash
npm ci
npm run package
code --install-extension better-peacock-4.2.5.vsix
```

Disable or uninstall the original Peacock extension before enabling Better Peacock. Both intentionally recognize the same `peacock.*` settings for migration compatibility.

## Documentation

Read the [guide](docs/guide/README.md) and [changelog](docs/changelog/README.md).

## Quick Usage

Let's see Better Peacock in action!

1. Create or open a VS Code workspace
1. Press `F1` to open the command palette
1. Type `Better Peacock`
1. Choose `Better Peacock: Change to a favorite color`
1. Choose one of the pre-defined colors and see how it changes your editor

Now enjoy exploring the rest of the features explained in the docs!

![Better Peacock Windows](resources/hero.png 'Better Peacock windows')

## Automatic Project and Branch Colors

Better Peacock adds opt-in automatic colors while preserving Peacock's manual colors, favorites, element adjustments, Remote Development, and Live Share behavior.

- Derive a branded color from a PNG, JPEG, SVG, or ICO project icon
- Derive a stable repository color from a normalized Git remote URL
- Fall back to a deterministic workspace color
- Override the status bar on exact or glob-matched branches such as `main`, `develop`, or `release/*`
- Refresh when the icon, Git remote, or current branch changes

Run **Better Peacock: Enable Automatic Workspace Color**, then optionally add protected-branch warnings:

```json
{
  "peacock.branchColors": {
    "main": "#d73a49",
    "develop": "#fb8c00",
    "release/*": "#8e44ad"
  }
}
```

See the [guide](docs/guide/README.md#automatic-colors) for source priority and all settings.

## Agent Beacon and Attention Queue

Agent Beacon turns supported Codex and Claude Code lifecycle hooks into a compact VS Code status item:

- working
- needs input or permission
- ready for review
- failed

**Requirements:** desktop VS Code (not the web build), and **Node.js installed locally**. Codex and Claude Code run the hook helper themselves, so they cannot use the Node runtime bundled with VS Code. Installation resolves an absolute path to your Node executable — so nvm, fnm, volta, and Homebrew installs all work — and refuses to write a hook it knows can never run.

The guided way to set this up is the **Track your background agents** walkthrough, in VS Code's Getting Started page (`Help ▸ Get Started`, or search *Welcome* in the Command Palette). It installs the hooks, covers the Codex trust step, and checks itself off as you go.

To do it by hand, run **Better Peacock: Install Agent Beacon Hooks** and choose Codex, Claude Code, or both. Existing hook files are backed up before Better Peacock's handlers are merged in.

The two agents then differ:

| | Claude Code | Codex |
| --- | --- | --- |
| Approval needed | No | **Yes — run `/hooks` and approve** |
| Picks up new hooks | Automatically, no restart | Restart the session |

**Codex silently skips any hook it has not been told to trust**, so without that approval the hooks look installed and never fire once. Trust is keyed to the hook definitions, so reinstalling invalidates it and needs approving again. **Better Peacock: Verify Agent Beacon Hooks** reports whether each agent's hooks have genuinely fired rather than merely been configured, and warns on its own if an agent runs without sending any events.

Once installed, the **Agent Attention Queue** appears in the Explorer sidebar in every window, listing projects that need input, are ready, or failed; **Better Peacock: Show Attention Queue** is the keyboard-driven equivalent. Selecting another project opens it in a new VS Code window. Agent Beacon writes state-only JSON to the operating system's temporary directory; it does not read or copy conversation transcripts.

## Git Risk and Environment Guardrails

Git Risk is enabled by default and stays hidden for clean repositories. It shows compact counts for conflicts, dirty files, unpushed commits, and significant behind counts; click it to open Source Control.

Environment Guardrails are opt-in and never infer that an environment is production. Configure explicit, case-insensitive glob rules when desired:

```json
{
  "peacock.environmentGuardrails": [
    {
      "name": "Production",
      "pattern": "*production*",
      "target": "remote",
      "severity": "error"
    }
  ]
}
```

## Resources

- [Better Peacock guide](docs/guide/README.md)
- [Get VS Code](https://code.visualstudio.com/?WT.mc_id=academic-0000-jopapa)
- [Create your first VS Code extension](https://code.visualstudio.com/api/get-started/your-first-extension?WT.mc_id=academic-0000-jopapa)
- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api?WT.mc_id=academic-0000-jopapa)
- [Learn how to add WebPack bundles to your favorite extensions](https://code.visualstudio.com/updates/v1_32?WT.mc_id=academic-0000-jopapa#_bundling-extensions-with-webpack?wt.mc_id=peacock-github-jopapa)

## Credits

Inspiration comes in many forms. These folks and teams have contributed either through ideas, issues, pull requests, or guidance. Thank you!

- Automatic workspace identity was inspired by [unique-window-colors](https://github.com/stuartcrobinson/unique-window-colors).
- Project icon color extraction was inspired by [auto-project-colors](https://github.com/tomcwatts/auto-project-colors).
- Normalized Git remote colors and the branch-warning request were inspired by [vscode-git-remote-color](https://github.com/jpoehnelt/vscode-git-remote-color) and [issue #5](https://github.com/jpoehnelt/vscode-git-remote-color/issues/5).

- The VS Code team and their incredibly [helpful guide for creating extensions](https://code.visualstudio.com/api/get-started/your-first-extension?WT.mc_id=academic-0000-jopapa)

- Here are some great [examples for extensions](https://github.com/Microsoft/vscode-extension-samples) from the VS Code team

## Code of Conduct

[Code of Conduct](./CODE_OF_CONDUCT.md).

## Contributing

The fastest way to contribute is with [Copilot CLI](https://github.com/features/copilot/cli/) — it knows this repo's conventions automatically:

```
copilot "Add a new command called 'Change to a Seasonal Color' that picks a color based on the current season"
```

Or contribute manually — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide:

1. Fork this repo and create a branch
2. `npm install` → make your changes → `npm test`
3. Open a PR

See [AGENTS.md](AGENTS.md) for the full project guide including architecture, patterns, and how to add commands/settings.

## Problems or Suggestions

[Open an issue here](https://github.com/chrismeehan20/better-peacock/issues)

## Contributors

[Contribution guidelines are located here](./CONTRIBUTING.md)

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/musicfuel"><img src="https://avatars1.githubusercontent.com/u/1085791?v=4?s=100" width="100px;" alt=""/><br /><sub><b>James Newell</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=musicfuel" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://juliangaramendy.dev"><img src="https://avatars1.githubusercontent.com/u/237818?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Julian</b></sub></a><br /><a href="#ideas-JulianG" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://twitter.com/legomushroom"><img src="https://avatars2.githubusercontent.com/u/1478800?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Oleg Solomka</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=legomushroom" title="Code">💻</a> <a href="https://github.com/johnpapa/vscode-peacock/commits?author=legomushroom" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://josephrex.me"><img src="https://avatars3.githubusercontent.com/u/5395567?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Joseph Rex</b></sub></a><br /><a href="#design-josephrexme" title="Design">🎨</a></td>
    <td align="center"><a href="http://www.samjulien.com"><img src="https://avatars1.githubusercontent.com/u/7738189?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Sam Julien</b></sub></a><br /><a href="#ideas-samjulien" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="http://www.tattoocoder.com"><img src="https://avatars1.githubusercontent.com/u/7681382?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Shayne Boyer</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=spboyer" title="Code">💻</a></td>
    <td align="center"><a href="http://a.shinynew.me"><img src="https://avatars1.githubusercontent.com/u/686963?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Burke Holland</b></sub></a><br /><a href="#ideas-burkeholland" title="Ideas, Planning, & Feedback">🤔</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://www.lostintangent.com"><img src="https://avatars3.githubusercontent.com/u/116461?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jonathan Carter</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=lostintangent" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/souzara"><img src="https://avatars2.githubusercontent.com/u/11986361?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ricardo Souza</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=souzara" title="Code">💻</a></td>
    <td align="center"><a href="https://doublslash.com"><img src="https://avatars1.githubusercontent.com/u/1748044?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Kushal Pandya</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=kushalpandya" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/egamma"><img src="https://avatars1.githubusercontent.com/u/172399?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Erich Gamma</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=egamma" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/christiannwamba"><img src="https://avatars2.githubusercontent.com/u/8108337?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Christian Nwamba</b></sub></a><br /><a href="#ideas-christiannwamba" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="http://mattbierner.com"><img src="https://avatars2.githubusercontent.com/u/12821956?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Matt Bierner</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=mjbvz" title="Code">💻</a></td>
    <td align="center"><a href="https://www.raymondcamden.com"><img src="https://avatars3.githubusercontent.com/u/393660?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Raymond Camden</b></sub></a><br /><a href="#ideas-cfjedimaster" title="Ideas, Planning, & Feedback">🤔</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://www.aaron-powell.com"><img src="https://avatars0.githubusercontent.com/u/434140?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Aaron Powell</b></sub></a><br /><a href="#ideas-aaronpowell" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/tanhakabir"><img src="https://avatars.githubusercontent.com/u/12758612?v=4?s=100" width="100px;" alt=""/><br /><sub><b>tanhakabir</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=tanhakabir" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ndrake"><img src="https://avatars.githubusercontent.com/u/73789?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nate Drake</b></sub></a><br /><a href="https://github.com/johnpapa/vscode-peacock/commits?author=ndrake" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
