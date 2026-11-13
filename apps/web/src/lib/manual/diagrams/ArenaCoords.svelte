<script lang="ts">
  // The arena as squared paper: origin bottom left, x to the right, y upwards.
  // The robot can be dragged: loc_x() and loc_y() follow it.
  import type { Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Handle from "../Handle.svelte";
  import { ROBOT_COLORS, uid } from "../geom.ts";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");
  let x = $state(300), y = $state(250);
  const arrow = uid("ar");
  const ticks = [0, 200, 400, 600, 800, 1000];
</script>

<figure class="dg-figure">
  <Plane x0={-110} y0={-90} w={1200} h={1180} width={460} label={it ? "L'arena vista dall'alto, con gli assi x e y" : "The arena seen from above, with the x and y axes"}>
    {#snippet children(v)}
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-fill-ink" /></marker></defs>
      <rect x={v.sx(0)} y={v.sy(1000)} width={1000 * v.k} height={1000 * v.k} class="dg-arena" />
      {#each [100, 200, 300, 400, 500, 600, 700, 800, 900] as g (g)}
        <line x1={v.sx(g)} y1={v.sy(0)} x2={v.sx(g)} y2={v.sy(1000)} class={g % 500 ? "dg-grid" : "dg-grid-major"} />
        <line x1={v.sx(0)} y1={v.sy(g)} x2={v.sx(1000)} y2={v.sy(g)} class={g % 500 ? "dg-grid" : "dg-grid-major"} />
      {/each}
      <line x1={v.sx(0)} y1={v.sy(0)} x2={v.sx(1080)} y2={v.sy(0)} class="dg-axis" marker-end="url(#{arrow})" />
      <line x1={v.sx(0)} y1={v.sy(0)} x2={v.sx(0)} y2={v.sy(1080)} class="dg-axis" marker-end="url(#{arrow})" />
      <text x={v.sx(1080)} y={v.sy(-55)} text-anchor="end" class="dg-axis-label">x</text>
      <text x={v.sx(30)} y={v.sy(1065)} class="dg-axis-label">y</text>
      {#each ticks as tk (tk)}
        <text x={v.sx(tk)} y={v.sy(-50)} text-anchor="middle" class="dg-small">{tk}</text>
        {#if tk}<text x={v.sx(-25)} y={v.sy(tk) + 4} text-anchor="end" class="dg-small">{tk}</text>{/if}
      {/each}
      <!-- projections of the robot on the axes -->
      <line x1={v.sx(x)} y1={v.sy(y)} x2={v.sx(x)} y2={v.sy(0)} class="dg-guide" />
      <line x1={v.sx(x)} y1={v.sy(y)} x2={v.sx(0)} y2={v.sy(y)} class="dg-guide" />
      <text x={v.sx(x) + 6} y={v.sy(0) - 8} class="dg-value">loc_x() = {x}</text>
      <text x={v.sx(0) + 6} y={v.sy(y) - 8} class="dg-value">loc_y() = {y}</text>
      <Handle {v} bind:x bind:y color={ROBOT_COLORS[0]} label={it ? "Il robot: trascinalo o spostalo con le frecce" : "The robot: drag it or move it with the arrow keys"} />
    {/snippet}
  </Plane>
  <figcaption>{it ? "Trascina il robot: le sue coordinate cambiano. (0, 0) è l'angolo in basso a sinistra, (1000, 1000) quello in alto a destra." : "Drag the robot: its coordinates change. (0, 0) is the bottom left corner, (1000, 1000) the top right one."}</figcaption>
</figure>
