import * as vscode from 'vscode';

/**
 * The Agent Beacon helper is a Node script, but the agent that runs it does not
 * inherit VS Code's environment. A bare `node` in the hook command therefore
 * depends on whatever PATH the agent happened to launch with — which breaks for
 * version-manager installs (nvm, fnm, volta) and for the many users who run
 * Codex or Claude Code as standalone binaries with no Node at all.
 *
 * Resolving an absolute path at install time removes the PATH dependency, and
 * failing to resolve one is worth telling the user about rather than writing a
 * hook that can never run.
 *
 * Everything here uses `vscode.workspace.fs` rather than `child_process`, since
 * this extension bundles for the webworker target as well as node.
 */

const unixCommonDirectories = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '/usr/bin',
  '/bin',
  '/opt/local/bin',
  '/snap/bin',
];

const windowsCommonDirectories = ['C:\\Program Files\\nodejs', 'C:\\Program Files (x86)\\nodejs'];

function executableName(platform: string) {
  return platform === 'win32' ? 'node.exe' : 'node';
}

function joinPath(directory: string, name: string, platform: string) {
  const separator = platform === 'win32' ? '\\' : '/';
  const trimmed = directory.replace(/[\\/]+$/, '');
  return `${trimmed}${separator}${name}`;
}

/**
 * Ordered candidate paths for a Node executable. PATH is searched first because
 * it reflects the user's actual choice of Node; the fixed directories only
 * cover the case where the extension host did not inherit a useful PATH.
 */
export function nodeExecutableCandidates(
  pathVariable: string | undefined,
  platform: string,
  home: string | undefined,
) {
  const name = executableName(platform);
  const separator = platform === 'win32' ? ';' : ':';
  const directories = [
    ...(pathVariable || '').split(separator),
    ...(platform === 'win32' ? windowsCommonDirectories : unixCommonDirectories),
    ...(home ? [joinPath(home, '.volta/bin', platform)] : []),
  ];

  const seen = new Set<string>();
  const candidates: string[] = [];
  directories.forEach(directory => {
    if (!directory || !directory.trim()) {
      return;
    }
    const candidate = joinPath(directory.trim(), name, platform);
    if (seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    candidates.push(candidate);
  });
  return candidates;
}

async function isFile(candidate: string) {
  try {
    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
    // A symlink to node still reports the File bit alongside SymbolicLink.
    return (stat.type & vscode.FileType.File) !== 0;
  } catch {
    return false;
  }
}

/**
 * Version-manager installs keep Node under a per-version directory, so they are
 * only reachable by listing. Newest version wins.
 */
async function versionManagerCandidates(home: string, platform: string) {
  const roots = [`${home}/.nvm/versions/node`, `${home}/.local/share/fnm/node-versions`];
  const found: string[] = [];
  for (const root of roots) {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(root));
    } catch {
      continue;
    }
    entries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .map(([name]) => name)
      .sort()
      .reverse()
      .forEach(name => {
        found.push(joinPath(`${root}/${name}/bin`, executableName(platform), platform));
        // fnm nests an extra `installation` directory.
        found.push(
          joinPath(`${root}/${name}/installation/bin`, executableName(platform), platform),
        );
      });
  }
  return found;
}

/**
 * First Node executable that actually exists on disk, or `undefined` when none
 * is found. Callers must treat `undefined` as a blocking problem, not a reason
 * to fall back to a bare `node`.
 */
export async function resolveNodeExecutable(
  pathVariable: string | undefined,
  platform: string,
  home: string | undefined,
) {
  for (const candidate of nodeExecutableCandidates(pathVariable, platform, home)) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }
  if (home) {
    for (const candidate of await versionManagerCandidates(home, platform)) {
      if (await isFile(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}
