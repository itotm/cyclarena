// Light/dark theme: "auto" follows the system, otherwise a fixed saved choice.
// index.html applies the theme before loading, to avoid flashes.

import { load, save } from "./storage.ts";

export type ThemeMode = "auto" | "light" | "dark";

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

class Theme {
  mode = $state<ThemeMode>(((m) => (m === "light" || m === "dark" ? m : "auto"))(load("theme")));
  systemDark = $state(media?.matches ?? false);
  resolved = $derived<"light" | "dark">(this.mode === "auto" ? (this.systemDark ? "dark" : "light") : this.mode);

  constructor() {
    media?.addEventListener("change", (e) => { this.systemDark = e.matches; this.apply(); });
    this.apply();
  }

  /** Switches to the next theme: auto → dark → light → auto. */
  cycle() {
    this.mode = this.mode === "auto" ? "dark" : this.mode === "dark" ? "light" : "auto";
    save("theme", this.mode);
    this.apply();
  }

  apply() {
    const dark = this.mode === "auto" ? (media?.matches ?? false) : this.mode === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
}

export const theme = new Theme();
