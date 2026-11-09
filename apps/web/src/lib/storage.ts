// localStorage may be missing or blocked (private windows, etc.):
// every access is guarded and the app also works without it.

const PREFIX = "paintarena.";

export function load(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export function save(key: string, value: string): void {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* nothing */ }
}
