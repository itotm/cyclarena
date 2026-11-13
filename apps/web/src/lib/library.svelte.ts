// The user's robots: created, renamed, imported from .pa files and
// exported. They are saved in the browser (localStorage) at every change and
// never leave the computer.
//
// Wherever a robot is chosen (matches, tournaments) it is identified by a
// reference: "u:<id>" for a user robot, "s:<id>" for a sample.

import type { Lang } from "@paintarena/engine";
import { i18n } from "./i18n.svelte.ts";
import { samples, sample } from "./samples.ts";
import { load, save, STORAGE_PREFIX } from "./storage.ts";

export interface UserRobot { id: string; name: string; source: string }

export type RobotRef = string;

export const MAX_NAME = 24;

const BLANK: Record<Lang, string> = {
  en: `// New robot
// Describe here what it does.

fn main() {
  loop {
    yield();
  }
}
`,
  it: `// Nuovo robot
// Descrivi qui cosa fa.

fn main() {
  loop {
    yield();
  }
}
`,
};

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

/** The robots saved in the browser (an empty list if there are none or they are unreadable). */
function parseRobots(text: string | null): UserRobot[] {
  try {
    const v = JSON.parse(text ?? "");
    if (Array.isArray(v)) return v.filter((r) => r && typeof r.id === "string" && typeof r.name === "string" && typeof r.source === "string");
  } catch { /* no saved robots */ }
  return [];
}

function loadRobots(): UserRobot[] {
  const list = parseRobots(load("robots"));
  if (list.length) return list;
  // first time: the first robot starts from the "first" sample
  return [{ id: newId(), name: i18n.t("myRobot"), source: sample("first")!.source }];
}

class Library {
  robots = $state<UserRobot[]>(loadRobots());
  currentId = $state("");
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const saved = load("robots.current");
    this.currentId = this.robots.some((r) => r.id === saved) ? saved! : this.robots[0].id;
    this.persist();
    if (typeof window !== "undefined") {
      // nothing typed is lost when the page is closed or hidden
      window.addEventListener("pagehide", () => this.flush());
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") this.flush(); });
      // another tab saved its list: take it, so the next save here does not erase its changes
      window.addEventListener("storage", (e) => { if (e.key === STORAGE_PREFIX + "robots") this.#sync(e.newValue); });
    }
  }

  /** Takes the list saved by another tab, keeping this tab's version of the robot being edited. */
  #sync(text: string | null) {
    const list = parseRobots(text);
    if (!list.length) return;
    const mine = this.get(this.currentId);
    if (mine) {
      const i = list.findIndex((r) => r.id === mine.id);
      if (i >= 0) list[i] = { ...list[i], source: mine.source };
      else list.push({ ...mine }); // deleted in the other tab while open here: it stays
    }
    this.robots = list;
  }

  get current(): UserRobot {
    return this.robots.find((r) => r.id === this.currentId) ?? this.robots[0];
  }

  get(id: string): UserRobot | undefined {
    return this.robots.find((r) => r.id === id);
  }

  persist() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    save("robots", JSON.stringify(this.robots));
    save("robots.current", this.currentId);
  }

  /** Delayed save (while typing). */
  persistSoon() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.#timer = undefined; this.persist(); }, 400);
  }

  /** Saves right away if a delayed save is pending. */
  flush() {
    if (this.#timer !== undefined) this.persist();
  }

  /** A free name: "Hunter", then "Hunter 2", "Hunter 3"… */
  uniqueName(base: string, except?: string): string {
    const name = cleanName(base) || i18n.t("myRobot");
    const taken = (n: string) => this.robots.some((r) => r.id !== except && r.name.toLowerCase() === n.toLowerCase());
    if (!taken(name)) return name;
    for (let k = 2; ; k++) {
      const suffix = " " + k;
      const n = name.slice(0, MAX_NAME - suffix.length) + suffix;
      if (!taken(n)) return n;
    }
  }

  select(id: string) {
    if (!this.get(id)) return;
    this.currentId = id;
    this.persist();
  }

  create(name: string, source = BLANK[i18n.lang]): string {
    const r = { id: newId(), name: this.uniqueName(name), source };
    this.robots.push(r);
    this.currentId = r.id;
    this.persist();
    return r.id;
  }

  /** New robot copied from a sample. */
  createFromSample(sampleId: string): string | null {
    const s = sample(sampleId);
    return s ? this.create(s.title, s.source) : null;
  }

  duplicate(id: string) {
    const r = this.get(id);
    if (r) this.create(r.name, r.source);
  }

  /** Returns the actual name (cleaned up and without duplicates). */
  rename(id: string, name: string): string {
    const r = this.get(id);
    if (!r) return "";
    const clean = cleanName(name);
    if (clean) r.name = this.uniqueName(clean, id);
    this.persist();
    return r.name;
  }

  setSource(id: string, source: string) {
    const r = this.get(id);
    if (!r || r.source === source) return;
    r.source = source;
    this.persistSoon();
  }

  remove(id: string) {
    const i = this.robots.findIndex((r) => r.id === id);
    if (i < 0) return;
    this.robots.splice(i, 1);
    if (!this.robots.length) this.robots.push({ id: newId(), name: i18n.t("myRobot"), source: BLANK[i18n.lang] });
    if (this.currentId === id) this.currentId = this.robots[Math.min(i, this.robots.length - 1)].id;
    this.persist();
  }

  /** Imports .pa files: each file becomes a robot, named after the file. */
  async importFiles(files: Iterable<File>): Promise<{ added: string[]; skipped: string[] }> {
    const added: string[] = [], skipped: string[] = [];
    let last = "";
    for (const f of files) {
      // no huge or binary files: a robot is a few KB of text
      if (f.size > 512 * 1024) { skipped.push(f.name); continue; }
      const text = (await f.text()).replace(/\r\n?/g, "\n");
      if (text.includes("\u0000")) { skipped.push(f.name); continue; }
      const r = { id: newId(), name: this.uniqueName(f.name.replace(/\.[^.]*$/, "")), source: text };
      this.robots.push(r);
      added.push(r.name);
      last = r.id;
    }
    if (last) this.currentId = last;
    this.persist();
    return { added, skipped };
  }

  /** Downloads the robot as a .pa file. */
  exportRobot(id: string) {
    const r = this.get(id);
    if (!r) return;
    const file = (r.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "robot") + ".pa";
    const url = URL.createObjectURL(new Blob([r.source], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: file });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const library = new Library();

// --- references ---

export const userRef = (id: string): RobotRef => "u:" + id;
export const sampleRef = (id: string): RobotRef => "s:" + id;

/** Name and code of a robot given by a reference (null if it no longer exists). */
export function resolveRef(ref: RobotRef): { name: string; source: string; user: boolean } | null {
  if (ref.startsWith("u:")) {
    const r = library.get(ref.slice(2));
    return r ? { name: r.name, source: r.source, user: true } : null;
  }
  if (ref.startsWith("s:")) {
    const s = sample(ref.slice(2));
    return s ? { name: s.title, source: s.source, user: false } : null;
  }
  return null;
}

/** All available robots: the user's first, then the samples. */
export function allRefs(): RobotRef[] {
  return [...library.robots.map((r) => userRef(r.id)), ...samples().map((s) => sampleRef(s.id))];
}
