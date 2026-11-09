<script lang="ts">
  // Head-to-head: for each pair, how often the row robot finished ahead of
  // the column robot (ties count as half). Blue = row is better, red =
  // column is better, grey = even.

  interface Props {
    /** Robot indices in ranking order. */
    order: number[];
    names: string[];
    colors: string[];
    n: number;
    ahead: number[];
    meetings: number[];
    tip: (row: string, col: string, pct: number, games: number) => string;
    label: string;
  }
  let { order, names, colors, n, ahead, meetings, tip, label }: Props = $props();

  let w = $state(300), h = $state(200);
  let hover = $state<{ a: number; b: number } | null>(null);
  const labelW = $derived(Math.min(130, Math.max(70, w * 0.3)));
  const cell = $derived(Math.max(8, Math.floor(Math.min((w - labelW) / order.length, (h - 18) / order.length))));
  const showValues = $derived(cell >= 26);

  function pct(a: number, b: number): number | null {
    const games = meetings[a * n + b];
    if (!games) return null;
    const tie = games - ahead[a * n + b] - ahead[b * n + a];
    return ((ahead[a * n + b] + tie / 2) / games) * 100;
  }

  // the cell under the pointer (a single handler for the whole grid)
  function onmove(e: PointerEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
    const a = Number(el?.dataset.a), b = Number(el?.dataset.b);
    hover = el && a !== b ? { a, b } : null;
  }

  // from 0 to 100: red → grey → blue (mixed in OKLab space)
  function fill(p: number | null): string {
    if (p === null) return "transparent";
    const d = Math.min(1, Math.abs(p - 50) / 50);
    return `color-mix(in oklab, ${p >= 50 ? "var(--div-pos)" : "var(--div-neg)"} ${Math.round(d * 100)}%, var(--div-mid))`;
  }
</script>

<div class="relative h-full min-h-0 w-full" bind:clientWidth={w} bind:clientHeight={h}>
  <div class="grid w-max" style:grid-template-columns="{labelW}px repeat({order.length}, {cell}px)" role="table" aria-label={label}
    onpointerleave={() => (hover = null)} onpointermove={onmove}>
    <div role="row" class="contents">
      <span role="columnheader"></span>
      {#each order as b, j (b)}
        <span role="columnheader" class="grid h-[18px] place-items-center font-mono text-[10px] text-dim" title={names[b]}>{j + 1}</span>
      {/each}
    </div>
    {#each order as a, i (a)}
      <div role="row" class="contents">
        <span role="rowheader" class="flex min-w-0 items-center gap-1.5 pr-2 text-xs" style:height="{cell}px">
          <span class="w-4 flex-none text-right font-mono text-[10px] text-dim">{i + 1}</span>
          <span class="diamond size-[7px]" style:--c={colors[a]}></span>
          <span class="truncate">{names[a]}</span>
        </span>
        {#each order as b (b)}
          {@const p = a === b ? null : pct(a, b)}
          <span role="cell" class="p-px" style:height="{cell}px">
            <span data-a={a} data-b={b} class={["grid h-full place-items-center rounded-[2px] font-mono text-[10px] tabular-nums",
              p !== null && Math.abs(p - 50) > 28 ? "text-white" : "text-ink",
              hover && hover.a === a && hover.b === b && "outline outline-ink"]}
              style:background={a === b ? "var(--surface-2)" : fill(p)}>
              {#if showValues && p !== null}{Math.round(p)}{/if}
            </span>
          </span>
        {/each}
      </div>
    {/each}
  </div>
  {#if hover}
    {@const p = pct(hover.a, hover.b)}
    {#if p !== null}
      <div class="pointer-events-none absolute right-0 bottom-0 z-10 max-w-72 rounded-xs border border-line-strong bg-surface-2 px-2 py-1 text-xs shadow-lg">
        {tip(names[hover.a], names[hover.b], p, meetings[hover.a * n + hover.b])}
      </div>
    {/if}
  {/if}
</div>
