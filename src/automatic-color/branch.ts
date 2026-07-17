import { isValidColorInput } from '../color-library';

function escapeRegularExpression(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function branchPatternMatches(pattern: string, branch: string) {
  if (pattern === branch) {
    return true;
  }
  const expression = `^${escapeRegularExpression(pattern).replace(/\*/g, '.*')}$`;
  return new RegExp(expression).test(branch);
}

/** Exact branch names win over glob patterns; invalid color values are ignored. */
export function resolveBranchColor(
  branch: string | undefined,
  branchColors: {
    [pattern: string]: string;
  },
) {
  if (!branch) {
    return undefined;
  }

  const exactColor = branchColors[branch];
  if (exactColor && isValidColorInput(exactColor)) {
    return exactColor;
  }

  const matchingPattern = Object.keys(branchColors).find(
    pattern => pattern !== branch && branchPatternMatches(pattern, branch),
  );
  const color = matchingPattern ? branchColors[matchingPattern] : undefined;
  return color && isValidColorInput(color) ? color : undefined;
}
