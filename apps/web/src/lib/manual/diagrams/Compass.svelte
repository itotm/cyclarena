<script lang="ts">
  // The directions of the game: 0 = east, 90 = north, and the angle grows
  // counterclockwise, unlike a compass. The arrow can be dragged.
  import { iatan2, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Handle from "../Handle.svelte";
  import { arcPath, polar, uid } from "../geom.ts";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");
  const R = 100;
  // the handle moves freely; the direction is the angle of the point
  let hx = $state(Math.round(R * Math.cos(Math.PI / 3))), hy = $state(Math.round(R * Math.sin(Math.PI / 3)));
  const dir = $derived(iatan2(hy, hx));
  const arrow = uid("cp");
  const LABELS = $derived([
    { a: 0, text: it ? "0 est" : "0 east" }, { a: 90, text: it ? "90 nord" : "90 north" },
    { a: 180, text: it ? "180 ovest" : "180 west" }, { a: 270, text: it ? "270 sud" : "270 south" },
  ]);
</script>

<figure class="dg-figure">
  <Plane x0={-175} y0={-150} w={350} h={300} width={420} label={it ? "Le direzioni in gradi" : "Directions in degrees"}>
    {#snippet children(v)}
      {@const cx = v.sx(0)}
      {@const cy = v.sy(0)}
      {@const r = R * v.k}
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-fill-accent" /></marker></defs>
      <circle {cx} {cy} r={r} class="dg-ring" />
      {#each Array.from({ length: 12 }, (_, i) => i * 30) as a (a)}
        {@const [x1, y1] = polar(cx, cy, r - 6, a)}
        {@const [x2, y2] = polar(cx, cy, r, a)}
        <line {x1} {y1} {x2} {y2} class="dg-tick" />
      {/each}
      {#each LABELS as l (l.a)}
        {@const [lx, ly] = polar(cx, cy, r + 22, l.a)}
        <text x={lx} y={ly + 4} text-anchor={l.a === 0 ? "start" : l.a === 180 ? "end" : "middle"} class="dg-label">{l.text}</text>
      {/each}
      <line x1={cx} y1={cy} x2={cx + r} y2={cy} class="dg-guide" />
      <path d={arcPath(cx, cy, r * 0.42, 0, dir)} class="dg-arc" marker-end="url(#{arrow})" />
      {@const [tx, ty] = polar(cx, cy, r, dir)}
      <line x1={cx} y1={cy} x2={tx} y2={ty} class="dg-ray" />
      {@const [lx, ly] = polar(cx, cy, r * 0.42 + 16, dir / 2)}
      <text x={lx} y={ly + 4} text-anchor="middle" class="dg-value">{dir}°</text>
      <circle {cx} {cy} r="4" class="dg-fill-ink" />
      <Handle {v} bind:x={hx} bind:y={hy} min={-140} max={140} r={8} at={[R * Math.cos((dir * Math.PI) / 180), R * Math.sin((dir * Math.PI) / 180)]} label={it ? `Direzione ${dir} gradi: trascina o usa le frecce` : `Direction ${dir} degrees: drag or use the arrow keys`} />
    {/snippet}
  </Plane>
  <figcaption>
    <code>drive({dir}, 50)</code> · <code>scan({dir}, 10)</code> · <code>throw({dir}, 300)</code>
    <br />{it ? "Trascina la punta della freccia. Gli angoli crescono in senso antiorario: al contrario della bussola, dove 90 è est." : "Drag the tip of the arrow. Angles grow counterclockwise: the opposite of a compass, where 90 is east."}
  </figcaption>
</figure>
