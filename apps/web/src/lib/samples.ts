// The sample robots, taken from the repository's robots/ folder: one set in
// English (robots/en) and one in Italian (robots/it), with the same programs.
// A sample is identified by its English name; title, description and code
// follow the interface language.

import type { Lang } from "@paintarena/engine";
import { i18n } from "./i18n.svelte.ts";

const files = import.meta.glob("../../../../robots/*/*.pa", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Display order, with the file name in each language. */
const NAMES: Record<string, Record<Lang, string>> = {
  first: { en: "first", it: "primo" },
  sprinkler: { en: "sprinkler", it: "irrigatore" },
  wanderer: { en: "wanderer", it: "vagabondo" },
  spiral: { en: "spiral", it: "spirale" },
  circuit: { en: "circuit", it: "circuito" },
  chaser: { en: "chaser", it: "inseguitore" },
  corner: { en: "corner", it: "angolo" },
  marksman: { en: "marksman", it: "tiratore" },
  tracker: { en: "tracker", it: "segugio" },
  mapper: { en: "mapper", it: "cartografo" },
  strategist: { en: "strategist", it: "stratega" },
};

export interface Sample { id: string; title: string; description: string; source: string }

function read(id: string, lang: Lang): Sample {
  const source = files[`../../../../robots/${lang}/${NAMES[id][lang]}.pa`] ?? "";
  const first = source.split("\n").find((l) => l.startsWith("//"))?.replace(/^\/\/\s*/, "") ?? id;
  const [title, ...rest] = first.split(":");
  return { id, title: title.trim(), description: rest.join(":").trim(), source };
}

const BY_LANG: Record<Lang, Sample[]> = {
  en: Object.keys(NAMES).map((id) => read(id, "en")),
  it: Object.keys(NAMES).map((id) => read(id, "it")),
};

/** The samples in the interface language. */
export function samples(lang: Lang = i18n.lang): Sample[] {
  return BY_LANG[lang];
}

export const sample = (id: string, lang: Lang = i18n.lang) => BY_LANG[lang].find((s) => s.id === id);
