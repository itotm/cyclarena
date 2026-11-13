// Completed missions and the chosen learning path, saved in the browser.

import type { LearnPath } from "./missions.ts";
import { load, save } from "./storage.ts";

function initial(): string[] {
  try {
    const v = JSON.parse(load("missions.done") ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

class Progress {
  done = $state<string[]>(initial());
  /** Learning path: basic (no trigonometry) unless advanced was chosen. */
  path = $state<LearnPath>(load("learn.path") === "advanced" ? "advanced" : "basic");

  setPath(path: LearnPath) {
    this.path = path;
    save("learn.path", path);
  }

  has(id: string): boolean {
    return this.done.includes(id);
  }

  complete(id: string) {
    if (this.has(id)) return;
    this.done.push(id);
    save("missions.done", JSON.stringify(this.done));
  }
}

export const progress = new Progress();
