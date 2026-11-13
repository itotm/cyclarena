<script lang="ts">
  // sin and cos as the game computes them: on a circle of radius SCALE, the
  // horizontal and vertical position of the point at deg degrees.
  import { icos, isin, SCALE, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import { polar } from "../geom.ts";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");
  let deg = $state(30);
  const c = $derived(icos(deg)), s = $derived(isin(deg));
</script>

<figure class="dg-figure">
  <Plane x0={-12500} y0={-12000} w={29500} h={24000} width={440} label={it ? "Seno e coseno sul cerchio" : "Sine and cosine on the circle"}>
    {#snippet children(v)}
      {@const cx = v.sx(0)}
      {@const cy = v.sy(0)}
      {@const r = SCALE * v.k}
      {@const [px, py] = polar(cx, cy, r, deg)}
      <line x1={v.sx(-12000)} y1={cy} x2={v.sx(12000)} y2={cy} class="dg-tick" />
      <line x1={cx} y1={v.sy(-11500)} x2={cx} y2={v.sy(11500)} class="dg-tick" />
      <circle {cx} {cy} r={r} class="dg-ring" />
      <text x={cx + r + 4} y={cy + 14} class="dg-small">SCALE</text>
      <line x1={cx} y1={cy} x2={px} y2={py} class="dg-ray" />
      <line x1={px} y1={py} x2={px} y2={cy} class="dg-leg" />
      <line x1={cx} y1={cy} x2={px} y2={cy} class="dg-leg-strong" />
      <text x={(cx + px) / 2} y={cy + (s >= 0 ? 16 : -8)} text-anchor="middle" class="dg-value">cos = {c}</text>
      <text x={px + (c >= 0 ? 6 : -6)} y={(cy + py) / 2 + 4} text-anchor={c >= 0 ? "start" : "end"} class="dg-value">sin = {s}</text>
      <circle cx={px} cy={py} r="5" class="dg-point" />
    {/snippet}
  </Plane>
  <div class="dg-controls">
    <label>deg <input type="range" min="0" max="359" bind:value={deg} /> <output>{deg}</output></label>
  </div>
  <div class="dg-out" aria-live="polite"><code>cos({deg}) = {c}</code> · <code>sin({deg}) = {s}</code></div>
  <figcaption>{it ? `Il linguaggio ha solo numeri interi: sin e cos valgono da −${SCALE} a ${SCALE} invece che da −1 a 1. Dopo aver moltiplicato si divide per SCALE.` : `The language only has integers: sin and cos go from −${SCALE} to ${SCALE} instead of −1 to 1. After multiplying, divide by SCALE.`}</figcaption>
</figure>
