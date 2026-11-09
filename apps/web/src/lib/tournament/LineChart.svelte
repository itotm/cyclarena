<script lang="ts">
  // Win percentage over the course of the tournament: it fluctuates at
  // first, then settles. One line per robot.

  interface Point { done: number; values: number[] }
  interface Props {
    history: Point[];
    names: string[];
    colors: string[];
    /** Order in which to list the robots (ranking). */
    order: number[];
    xLabel: string;
    fmt: (n: number) => string;
  }
  let { history, names, colors, order, xLabel, fmt }: Props = $props();

  let w = $state(300), h = $state(200);
  let hover = $state<number | null>(null);
  const M = { l: 34, r: 10, t: 8, b: 22 };
  const pw = $derived(Math.max(10, w - M.l - M.r));
  const ph = $derived(Math.max(10, h - M.t - M.b));
  const xMax = $derived(Math.max(1, history.at(-1)?.done ?? 1));
  const yMax = $derived.by(() => {
    let mx = 0;
    for (const p of history) for (const v of p.values) mx = Math.max(mx, v);
    return Math.min(100, Math.max(20, Math.ceil(mx / 20) * 20));
  });
  const x = (v: number) => M.l + (v / xMax) * pw;
  const y = (v: number) => M.t + ph - (v / yMax) * ph;
  const yTicks = $derived(Array.from({ length: 5 }, (_, i) => Math.round((yMax * i) / 4)));
  const xTicks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(xMax * f)));

  const paths = $derived(names.map((_, k) =>
    history.map((p, i) => `${i ? "L" : "M"}${x(p.done).toFixed(1)},${y(p.values[k]).toFixed(1)}`).join("")));

  function onmove(e: PointerEvent) {
    if (!history.length) return;
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const v = ((e.clientX - rect.left - M.l) / pw) * xMax;
    let best = 0;
    for (let i = 1; i < history.length; i++) if (Math.abs(history[i].done - v) < Math.abs(history[best].done - v)) best = i;
    hover = best;
  }

  const hp = $derived(hover !== null ? history[hover] : null);
  const hoverRows = $derived(hp ? order.map((k) => ({ k, v: hp.values[k] })).sort((a, b) => b.v - a.v) : []);
</script>

<div class="relative h-full min-h-0 w-full" bind:clientWidth={w} bind:clientHeight={h}>
  <svg width={w} height={h} class="block" role="img" aria-label={xLabel}
    onpointermove={onmove} onpointerleave={() => (hover = null)}>
    {#each yTicks as v (v)}
      <line x1={M.l} x2={M.l + pw} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
      <text x={M.l - 6} y={y(v)} dy="0.32em" text-anchor="end" class="fill-dim font-mono text-[10px] tabular-nums">{v}%</text>
    {/each}
    {#each xTicks as v, i (i)}
      <text x={x(v)} y={h - 6} text-anchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} class="fill-dim font-mono text-[10px] tabular-nums">{fmt(v)}</text>
    {/each}
    <line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke="var(--line-strong)" />
    {#each [...order].reverse() as k (k)}
      <path d={paths[k]} fill="none" stroke={colors[k]} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    {/each}
    {#if hp}
      <line x1={x(hp.done)} x2={x(hp.done)} y1={M.t} y2={M.t + ph} stroke="var(--line-strong)" />
      {#each order as k (k)}
        <circle cx={x(hp.done)} cy={y(hp.values[k])} r="4" fill={colors[k]} stroke="var(--surface)" stroke-width="2" />
      {/each}
    {/if}
  </svg>
  {#if hp}
    <div class={["pointer-events-none absolute top-1 z-10 min-w-40 rounded-xs border border-line-strong bg-surface-2 px-2 py-1.5 text-xs shadow-lg",
      x(hp.done) > w / 2 ? "right-[calc(100%-var(--x)+10px)]" : "left-[calc(var(--x)+10px)]"]} style:--x="{x(hp.done)}px">
      <div class="mb-1 font-mono text-dim">{fmt(hp.done)} {xLabel}</div>
      {#each hoverRows as r (r.k)}
        <div class="flex items-center gap-1.5"><span class="diamond size-[7px]" style:--c={colors[r.k]}></span>
          <span class="flex-1 truncate">{names[r.k]}</span><span class="font-mono tabular-nums">{r.v.toFixed(1)}%</span></div>
      {/each}
    </div>
  {/if}
</div>
