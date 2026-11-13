// Every system function is documented in both languages and has a place in
// the manual.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILTINS } from "@paintarena/engine";
import { BUILTIN_DOCS, BUILTIN_EQUIV, COORD_FNS, extraCostText, FN_GROUPS } from "../src/lib/builtinDocs.ts";
import { FN_CARDS } from "../src/lib/manual/fnCards.ts";

test("every system function is documented and in exactly one group of the manual", () => {
  for (const b of BUILTINS) {
    assert.ok(BUILTIN_DOCS[b.name]?.it && BUILTIN_DOCS[b.name]?.en, `${b.name}: description missing`);
    assert.equal(FN_GROUPS.filter((g) => g.fns.includes(b.name)).length, 1, `${b.name}: groups`);
    // a variable cost written in words must have its Italian text
    if (b.extraCost && /[a-z]{4,}/.test(b.extraCost)) assert.notEqual(extraCostText(b, "it"), extraCostText(b, "en"), `${b.name}: variable cost not translated`);
  }
  for (const g of FN_GROUPS) for (const f of g.fns) assert.ok(BUILTINS.some((b) => b.name === f), `${g.id}: unknown function ${f}`);
  for (const f of COORD_FNS) assert.ok(BUILTIN_EQUIV[f], `${f}: equivalent formula missing`);
});

test("every function outside the utilities has a card in the manual", () => {
  const carded = new Set(FN_CARDS.flatMap((c) => c.names));
  for (const g of FN_GROUPS) {
    if (g.id === "util") continue;
    for (const f of g.fns) assert.ok(carded.has(f), `${f}: no card`);
  }
  for (const c of FN_CARDS) {
    assert.ok(c.example.it && c.example.en, `${c.id}: example missing`);
    for (const n of c.names) assert.equal(FN_GROUPS.find((g) => g.fns.includes(n))?.id, c.group, `${n}: card in the wrong group`);
  }
});
