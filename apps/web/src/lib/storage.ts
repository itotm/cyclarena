// localStorage may be missing or blocked (private windows, etc.):
// every access is guarded and the app also works without it.

export const STORAGE_PREFIX = "paintarena.";
const PREFIX = STORAGE_PREFIX;

export function load(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export function save(key: string, value: string): void {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* nothing */ }
}
