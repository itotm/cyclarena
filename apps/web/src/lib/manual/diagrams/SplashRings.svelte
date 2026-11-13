<script lang="ts">
  // The splash, enlarged: how much paint a robot gets depending on its
  // distance from the burst point. The robot can be dragged.
  import { idist, RULES_V0 as R, splashPaint, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Handle from "../Handle.svelte";
  import { ROBOT_COLORS } from "../geom.ts";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");
  const outer = R.splash[R.splash.length - 1].range;
  let x = $state(12), y = $state(5);
  const d = $derived(idist(x, y));
  const paint = $derived(splashPaint(R, d * 1000));
</script>

<figure class="dg-figure">
  <Plane x0={-50} y0={-50} w={100} h={100} width={360} label={it ? "Lo schizzo ingrandito" : "The splash, enlarged"}>
    {#snippet children(v)}
      {@const cx = v.sx(0)}
      {@const cy = v.sy(0)}
      {#each [...R.splash].reverse() as l, i (l.range)}
        <circle {cx} {cy} r={l.range * v.k} class="dg-splash-fill" style:opacity={0.12 + i * 0.1} />
      {/each}
      <!-- labels in a column below the centre, each in the middle of its ring -->
      {#each R.splash as l, i (l.range)}
        {@const inner = i ? R.splash[i - 1].range : 0}
        <text x={cx} y={cy + ((inner + l.range) / 2) * v.k + 4} text-anchor="middle" class="dg-ring-label">{l.paint}%</text>
      {/each}
      <line x1={cx} y1={cy} x2={v.sx(x)} y2={v.sy(y)} class="dg-guide" />
      <circle {cx} {cy} r="3" class="dg-fill-ink" />
      <Handle {v} bind:x bind:y min={-48} max={48} r={6} color={ROBOT_COLORS[1]} label={it ? "Robot vicino allo scoppio" : "Robot near the burst"} />
    {/snippet}
  </Plane>
  <div class="dg-out" aria-live="polite">
    {it ? `a ${d} m dallo scoppio: ${paint ? "+" + paint + "% di vernice" : "nessuna vernice"}` : `${d} m from the burst: ${paint ? "+" + paint + "% paint" : "no paint"}`}
  </div>
  <figcaption>{it ? `Trascina il robot: più è vicino al punto di scoppio, più si colora. Oltre ${outer} metri non lo tocca.` : `Drag the robot: the nearer the burst point, the more paint it gets. Beyond ${outer} metres it is not touched.`}</figcaption>
</figure>
