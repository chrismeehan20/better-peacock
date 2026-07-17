import * as vscode from 'vscode';
import { normalizeGitRemote } from './hash';

export interface GitIdentity {
  branch?: string;
  remoteUrl?: string;
  normalizedRemote?: string;
}

interface GitRemote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

interface GitRepository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { name?: string };
    remotes: GitRemote[];
    onDidChange: vscode.Event<void>;
  };
}

interface GitApi {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
}

interface GitExtension {
  getAPI(version: 1): GitApi;
}

async function getGitApi() {
  try {
    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!extension) {
      return undefined;
    }
    const exports = extension.isActive ? extension.exports : await extension.activate();
    return exports && exports.getAPI(1);
  } catch {
    return undefined;
  }
}

function getWorkspaceRepository(repositories: GitRepository[]) {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) {
    return repositories[0];
  }
  const folderUri = folder.uri.toString();
  return (
    repositories.find(repository => folderUri.indexOf(repository.rootUri.toString()) === 0) ||
    repositories[0]
  );
}

export async function getGitIdentity(remoteName: string): Promise<GitIdentity> {
  const api = await getGitApi();
  const repository = api && getWorkspaceRepository(api.repositories);
  if (!repository) {
    return {};
  }

  const remote =
    repository.state.remotes.find(candidate => candidate.name === remoteName) ||
    repository.state.remotes[0];
  const remoteUrl = remote && (remote.pushUrl || remote.fetchUrl);
  return {
    branch: repository.state.HEAD && repository.state.HEAD.name,
    remoteUrl,
    normalizedRemote: remoteUrl ? normalizeGitRemote(remoteUrl) : undefined,
  };
}

export async function watchGitIdentity(context: vscode.ExtensionContext, onDidChange: () => void) {
  const api = await getGitApi();
  if (!api) {
    return;
  }

  const watched: { [root: string]: boolean } = {};
  const signatures: { [root: string]: string } = {};
  const signature = (repository: GitRepository) => {
    const head = (repository.state.HEAD && repository.state.HEAD.name) || '';
    const remotes = repository.state.remotes
      .map(remote => `${remote.name}:${remote.pushUrl || remote.fetchUrl || ''}`)
      .sort()
      .join('|');
    return `${head}|${remotes}`;
  };
  const watch = (repository: GitRepository) => {
    const root = repository.rootUri.toString();
    if (!watched[root]) {
      watched[root] = true;
      signatures[root] = signature(repository);
      context.subscriptions.push(
        repository.state.onDidChange(() => {
          const next = signature(repository);
          if (next !== signatures[root]) {
            signatures[root] = next;
            onDidChange();
          }
        }),
      );
    }
  };

  api.repositories.forEach(watch);
  context.subscriptions.push(
    api.onDidOpenRepository(repository => {
      watch(repository);
      onDidChange();
    }),
  );
}
