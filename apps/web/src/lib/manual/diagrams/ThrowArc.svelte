<script lang="ts">
  // throw(dir, dist): the balloon flies straight and bursts at dist metres (at
  // most MAX_RANGE). The dashed circle is the maximum range.
  import { RULES_V0 as R, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Robot from "../Robot.svelte";
  import { polar, ROBOT_COLORS, uid } from "../geom.ts";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");
  const ME = { x: 200, y: 260 };
  let dir = $state(35), dist = $state(450);
  const burst = $derived(Math.min(dist, R.throwRange));
  const flight = $derived(Math.max(1, Math.ceil(burst / (R.balloonStep / 1000))));
  const outer = R.splash[R.splash.length - 1].range;
  const arrow = uid("th");
</script>

<figure class="dg-figure">
  <Plane w={1000} h={1000} width={440} label={it ? "Il lancio di un gavettone" : "Throwing a balloon"}>
    {#snippet children(v)}
      {@const cx = v.sx(ME.x)}
      {@const cy = v.sy(ME.y)}
      {@const [bx, by] = polar(cx, cy, burst * v.k, dir)}
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-fill-accent" /></marker></defs>
      <rect width={v.width} height={v.height} class="dg-arena" />
      <circle {cx} {cy} r={R.throwRange * v.k} class="dg-range" />
      <line x1={cx} y1={cy} x2={bx} y2={by} class="dg-ray" marker-end="url(#{arrow})" />
      {#each R.splash as l (l.range)}<circle cx={bx} cy={by} r={l.range * v.k} class="dg-splash" />{/each}
      <text x={bx + outer * v.k + 4} y={by + 4} class="dg-value">{burst} m</text>
      <Robot {v} x={ME.x} y={ME.y} color={ROBOT_COLORS[0]} heading={dir} />
      <text x={cx} y={cy + 26} text-anchor="middle" class="dg-small">{it ? "gittata massima" : "maximum range"} {R.throwRange} m ↗</text>
    {/snippet}
  </Plane>
  <div class="dg-controls">
    <label>dir <input type="range" min="0" max="359" bind:value={dir} /> <output>{dir}</output></label>
    <label>dist <input type="range" min="0" max="900" step="10" bind:value={dist} /> <output>{dist}</output></label>
  </div>
  <div class="dg-out" aria-live="polite">
    <code>throw({dir}, {dist})</code> · {dist > R.throwRange ? (it ? `oltre ${R.throwRange} m: scoppia a ${R.throwRange} m` : `beyond ${R.throwRange} m: bursts at ${R.throwRange} m`) : (it ? `scoppia a ${burst} m` : `bursts at ${burst} m`)}
    · {it ? `arriva in ${flight} tick` : `arrives in ${flight} ticks`}
  </div>
  <figcaption>{it ? `Il gavettone vola a ${R.balloonStep / 1000} m per tick. I cerchi attorno al punto di scoppio sono lo schizzo: chi è dentro si colora, anche chi ha lanciato.` : `The balloon flies ${R.balloonStep / 1000} m per tick. The circles around the burst point are the splash: whoever is inside gets painted, the thrower too.`}</figcaption>
</figure>
