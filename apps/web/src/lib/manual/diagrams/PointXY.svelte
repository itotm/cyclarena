<script lang="ts">
  // point_x and point_y: from the robot, dist metres towards dir. With `trig`
  // the two legs show the same calculation with cos and sin.
  import { icos, isin, SCALE, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Handle from "../Handle.svelte";
  import Robot from "../Robot.svelte";
  import { arcPath, polar, ROBOT_COLORS, uid } from "../geom.ts";

  interface Props { lang: Lang; trig?: boolean }
  let { lang, trig = false }: Props = $props();
  const it = $derived(lang === "it");
  let rx = $state(260), ry = $state(300);
  let dir = $state(40), dist = $state(420);
  // the same arithmetic as the game (truncating division)
  const ox = $derived(Math.trunc((dist * icos(dir)) / SCALE));
  const oy = $derived(Math.trunc((dist * isin(dir)) / SCALE));
  const px = $derived(rx + ox), py = $derived(ry + oy);
  const arrow = uid("pt");
</script>

<figure class="dg-figure">
  <Plane x0={-100} y0={-100} w={1200} h={1200} width={440} label={it ? "Il punto a una certa distanza e direzione dal robot" : "The point at a given distance and direction from the robot"}>
    {#snippet children(v)}
      {@const cx = v.sx(rx)}
      {@const cy = v.sy(ry)}
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-fill-accent" /></marker></defs>
      <rect x={v.sx(0)} y={v.sy(1000)} width={1000 * v.k} height={1000 * v.k} class="dg-arena" />
      <!-- projections on the axes: the two results -->
      <line x1={v.sx(px)} y1={v.sy(py)} x2={v.sx(px)} y2={v.sy(0)} class="dg-guide" />
      <line x1={v.sx(px)} y1={v.sy(py)} x2={v.sx(0)} y2={v.sy(py)} class="dg-guide" />
      <text x={v.sx(px)} y={v.sy(0) + 16} text-anchor="middle" class="dg-value">x = {px}</text>
      <text x={v.sx(0) - 6} y={v.sy(py) + 4} text-anchor="end" class="dg-value">y = {py}</text>
      {#if trig}
        <line x1={cx} y1={cy} x2={v.sx(px)} y2={cy} class="dg-leg" />
        <line x1={v.sx(px)} y1={cy} x2={v.sx(px)} y2={v.sy(py)} class="dg-leg" />
        <text x={(cx + v.sx(px)) / 2} y={cy + (oy >= 0 ? 16 : -8)} text-anchor="middle" class="dg-small">d·cos = {ox}</text>
        <text x={v.sx(px) + (ox >= 0 ? 6 : -6)} y={(cy + v.sy(py)) / 2 + 4} text-anchor={ox >= 0 ? "start" : "end"} class="dg-small">d·sin = {oy}</text>
      {/if}
      <line x1={cx} y1={cy} x2={cx + 60} y2={cy} class="dg-tick" />
      {#if dir % 360}<path d={arcPath(cx, cy, 30, 0, dir)} class="dg-arc" />{/if}
      {@const [lx, ly] = polar(cx, cy, 46, dir / 2)}
      <text x={lx} y={ly + 4} text-anchor="middle" class="dg-small">{dir}°</text>
      <line x1={cx} y1={cy} x2={v.sx(px)} y2={v.sy(py)} class="dg-ray" marker-end="url(#{arrow})" />
      <circle cx={v.sx(px)} cy={v.sy(py)} r="6" class="dg-point" />
      <Robot {v} x={rx} y={ry} color={ROBOT_COLORS[0]} />
      <Handle {v} bind:x={rx} bind:y={ry} color={ROBOT_COLORS[0]} label={it ? "Il tuo robot" : "Your robot"} />
    {/snippet}
  </Plane>
  <div class="dg-controls">
    <label>dir <input type="range" min="0" max="359" bind:value={dir} /> <output>{dir}</output></label>
    <label>dist <input type="range" min="0" max="700" step="5" bind:value={dist} /> <output>{dist}</output></label>
  </div>
  <div class="dg-out" aria-live="polite">
    {#if trig}
      <code>loc_x() + {dist} * cos({dir}) / SCALE = {px}</code> · <code>loc_y() + {dist} * sin({dir}) / SCALE = {py}</code>
    {:else}
      <code>point_x({dir}, {dist}) = {px}</code> · <code>point_y({dir}, {dist}) = {py}</code>
    {/if}
  </div>
  <figcaption>{trig
    ? (it ? "La distanza è il lato lungo di un triangolo rettangolo: il coseno dice quanta ne va in orizzontale, il seno quanta in verticale." : "The distance is the long side of a right triangle: the cosine says how much of it goes horizontally, the sine how much vertically.")
    : (it ? "Scegli direzione e distanza (per esempio quelle date dal radar) e trascina il robot: il punto e le sue coordinate cambiano." : "Pick a direction and a distance (for example the ones from the radar) and drag the robot: the point and its coordinates change.")}</figcaption>
</figure>
