import * as tinycolor from 'tinycolor2';

/** Normalize the common HTTPS, SSH, and scp-like Git URL forms to one stable seed. */
export function normalizeGitRemote(remoteUrl: string) {
  let normalized = remoteUrl.trim().replace(/\\/g, '/');
  normalized = normalized.replace(/^git@([^:]+):/, '$1/');
  normalized = normalized.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  normalized = normalized.replace(/^[^@/]+@/, '');
  normalized = normalized.replace(/:\d+\//, '/');
  normalized = normalized.replace(/\.git\/?$/i, '');
  normalized = normalized.replace(/\/+$/, '');
  return normalized.toLowerCase();
}

/** FNV-1a gives a stable, well-distributed unsigned 32-bit hash in every extension host. */
export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Convert an identity into a saturated mid-tone that remains useful as editor chrome. */
export function hashToColor(value: string) {
  const hash = hashString(value);
  const hue = hash % 360;
  const saturation = 55 + ((hash >>> 8) % 26);
  const lightness = 32 + ((hash >>> 16) % 17);
  return tinycolor({ h: hue, s: saturation / 100, l: lightness / 100 }).toHexString();
}
