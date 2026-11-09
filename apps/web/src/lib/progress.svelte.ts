// Completed missions, saved in the browser.

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
