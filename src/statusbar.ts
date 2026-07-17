import { StatusBarAlignment, window, StatusBarItem } from 'vscode';
import { getShowColorInStatusBar, getEnvironmentAwareColor } from './configuration';
import { Commands } from './models';

const _statusBarItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);

export interface PeacockStatusBarContext {
  color: string;
  source?: string;
  branch?: string;
  branchColor?: string;
  branchForegroundColor?: string;
}

let _statusBarContext: PeacockStatusBarContext | undefined;

export const getStatusBarItem = () => {
  updateStatusBar();
  return _statusBarItem;
};

export function clearStatusBar() {
  const sb = _statusBarItem;
  _statusBarContext = undefined;
  sb.text = '';
  sb.color = undefined;
  sb.hide();
}

export function getDisplayedColor() {
  return (_statusBarContext && _statusBarContext.color) || getEnvironmentAwareColor();
}

export function updateStatusBar(context?: PeacockStatusBarContext) {
  const sb = _statusBarItem;
  if (context) {
    _statusBarContext = context;
  }
  const show = getShowColorInStatusBar();
  const color = getDisplayedColor();
  const status = _statusBarContext;
  sb.text =
    status && status.branch
      ? `$(git-branch) ${status.branch} $(paintcan) ${color}`
      : `$(paintcan) ${color}`;
  sb.command = Commands.showAndCopyCurrentColor;
  sb.color = status && status.branchForegroundColor;
  const details = [
    `Peacock color: ${color}`,
    status && status.source ? `Source: ${status.source}` : '',
    status && status.branch ? `Branch: ${status.branch}` : '',
    status && status.branchColor ? `Branch status bar override: ${status.branchColor}` : '',
    'Click to copy the base color',
  ].filter(Boolean);
  sb.tooltip = details.join('\n');
  if (show && !!color) {
    sb.show();
  } else {
    clearStatusBar();
  }
}
