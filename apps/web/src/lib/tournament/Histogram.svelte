<script lang="ts">
  // How long matches last: equal-width histogram, from 0 to the maximum time.

  interface Props {
    bins: number[];
    maxTicks: number;
    /** Tooltip text for a bar. */
    tip: (from: number, to: number, count: number, share: number) => string;
    fmt: (n: number) => string;
    label: string;
  }
  let { bins, maxTicks, tip, fmt, label }: Props = $props();

  let w = $state(300), h = $state(160);
  let hover = $state<number | null>(null);
  const M = { l: 34, r: 8, t: 8, b: 22 };
  const pw = $derived(Math.max(10, w - M.l - M.r));
  const ph = $derived(Math.max(10, h - M.t - M.b));
  const total = $derived(bins.reduce((a, b) => a + b, 0));
  const peak = $derived(Math.max(1, ...bins));
  // scale as a percentage of matches, with a "round" maximum
  const yMax = $derived.by(() => {
    const p = (peak / Math.max(1, total)) * 100;
    const step = p > 40 ? 20 : p > 20 ? 10 : p > 8 ? 5 : p > 4 ? 2 : 1;
    return Math.max(step, Math.ceil(p / step) * step);
  });
  const slot = $derived(pw / bins.length);
  const bw = $derived(Math.max(1, Math.min(24, slot - 2)));
  const y = (share: number) => M.t + ph - (share / yMax) * ph;
  const width = $derived(maxTicks / bins.length);

  // bar with a rounded top and a square base
  function col(x0: number, y0: number, bw: number, base: number): string {
    const r = Math.min(4, bw / 2, (base - y0) / 2);
    if (base - y0 < 0.5) return "";
    return `M${x0},${base}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${base}Z`;
  }
</script>

<div class="relative h-full min-h-0 w-full" bind:clientWidth={w} bind:clientHeight={h}>
  <svg width={w} height={h} class="block" role="img" aria-label={label} onpointerleave={() => (hover = null)}>
    {#each [0, 0.5, 1] as f (f)}
      <line x1={M.l} x2={M.l + pw} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--chart-grid)" />
      <text x={M.l - 6} y={y(yMax * f)} dy="0.32em" text-anchor="end" class="fill-dim font-mono text-[10px] tabular-nums">{yMax * f}%</text>
    {/each}
    {#each [0, 0.25, 0.5, 0.75, 1] as f, i (f)}
      <text x={M.l + pw * f} y={h - 6} text-anchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} class="fill-dim font-mono text-[10px] tabular-nums">{fmt(Math.round(maxTicks * f))}</text>
    {/each}
    {#each bins as c, i (i)}
      {@const share = total ? (c / total) * 100 : 0}
      <path d={col(M.l + i * slot + (slot - bw) / 2, y(share), bw, M.t + ph)} fill="var(--accent)" opacity={hover === null || hover === i ? 1 : 0.55} />
      <!-- hit area larger than the bar -->
      <rect x={M.l + i * slot} y={M.t} width={slot} height={ph} fill="transparent" role="presentation" onpointerenter={() => (hover = i)} />
    {/each}
    <line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke="var(--line-strong)" />
  </svg>
  {#if hover !== null}
    {@const cx = M.l + (hover + 0.5) * slot}
    <div class={["pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-xs border border-line-strong bg-surface-2 px-2 py-1 text-xs shadow-lg",
      cx > w / 2 ? "right-[calc(100%-var(--x)+8px)]" : "left-[calc(var(--x)+8px)]"]} style:--x="{cx}px">
      {tip(Math.round(hover * width), Math.round((hover + 1) * width), bins[hover], total ? (bins[hover] / total) * 100 : 0)}
    </div>
  {/if}
</div>
