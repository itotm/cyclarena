<script lang="ts">
  // One card of the function reference: signature, cost, what it does, what
  // it is equivalent to, an example and, where it helps, a diagram.
  import { BUILTINS, type Lang } from "@paintarena/engine";
  import { BUILTIN_DOCS, BUILTIN_EQUIV, extraCostText } from "../builtinDocs.ts";
  import type { FnCard } from "./fnCards.ts";
  import Diagram from "./Diagram.svelte";

  let { card, lang }: { card: FnCard; lang: Lang } = $props();
  const it = $derived(lang === "it");
  const fns = $derived(card.names.map((n) => BUILTINS.find((b) => b.name === n)!));
</script>

<article id="m-fn-{card.id}" class="fn-card">
  <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
    {#each fns as b (b.id)}
      <h4 class="m-0 font-mono text-[0.98rem] font-bold text-(--syn-builtin)">{b.name}({b.params.join(", ")})</h4>
    {/each}
    <span class="ml-auto font-mono text-xs text-muted">
      {fns.map((b) => b.cost + (b.extraCost ? " " + extraCostText(b, lang) : "")).join(" · ")} {it ? "cicli" : "cycles"}
    </span>
  </header>
  {#each fns as b (b.id)}
    <p>{#if fns.length > 1}<code>{b.name}</code>{": "}{/if}{BUILTIN_DOCS[b.name]?.[lang]}</p>
  {/each}
  {#each fns as b (b.id)}
    {#if BUILTIN_EQUIV[b.name]}
      <p class="equiv"><span class="label-tech">{it ? "uguale a" : "same as"}</span> <code>{BUILTIN_EQUIV[b.name]}</code></p>
    {/if}
  {/each}
  <pre><code>{card.example[lang]}</code></pre>
  {#if card.diagram}<Diagram id={card.diagram} {lang} />{/if}
  {#if card.extra}<Diagram id={card.extra} {lang} />{/if}
</article>
