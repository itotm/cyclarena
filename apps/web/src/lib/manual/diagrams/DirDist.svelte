<script lang="ts">
  // From the robot to a point: direction and distance. Both points can be
  // dragged. Depending on `mode` the readout shows dir_to/dist_to, the same
  // calculation with atan2 and sqrt, drive_to or throw_at.
  import { iatan2, idist, RULES_V0 as R, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Handle from "../Handle.svelte";
  import Robot from "../Robot.svelte";
  import { arcPath, polar, ROBOT_COLORS, uid } from "../geom.ts";

  interface Props { lang: Lang; mode?: "dirdist" | "atan2" | "drive" | "throw_at" }
  let { lang, mode = "dirdist" }: Props = $props();
  const it = $derived(lang === "it");
  let rx = $state(220), ry = $state(250);
  let tx = $state(750), ty = $state(600);
  const dx = $derived(tx - rx), dy = $derived(ty - ry);
  const dir = $derived(iatan2(dy, dx));
  const dist = $derived(idist(dx, dy));
  const burst = $derived(Math.min(dist, R.throwRange));
  const arrow = uid("dd");
  const target = $derived(mode === "throw_at" ? (it ? "Punto di scoppio" : "Burst point") : it ? "Il punto (x, y)" : "The point (x, y)");
</script>

<figure class="dg-figure">
  <Plane w={1000} h={1000} width={440} label={it ? "Direzione e distanza di un punto visto dal robot" : "Direction and distance of a point seen from the robot"}>
    {#snippet children(v)}
      {@const cx = v.sx(rx)}
      {@const cy = v.sy(ry)}
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-fill-accent" /></marker></defs>
      <rect width={v.width} height={v.height} class="dg-arena" />
      {#if mode === "throw_at"}<circle {cx} {cy} r={R.throwRange * v.k} class="dg-range" />{/if}
      <!-- dx and dy: how far the point is horizontally and vertically -->
      <line x1={cx} y1={cy} x2={v.sx(tx)} y2={cy} class="dg-guide" />
      <line x1={v.sx(tx)} y1={cy} x2={v.sx(tx)} y2={v.sy(ty)} class="dg-guide" />
      <text x={(cx + v.sx(tx)) / 2} y={cy + (dy >= 0 ? 16 : -8)} text-anchor="middle" class="dg-small">dx = {dx}</text>
      <text x={v.sx(tx) + (dx >= 0 ? 6 : -6)} y={(cy + v.sy(ty)) / 2} text-anchor={dx >= 0 ? "start" : "end"} class="dg-small">dy = {dy}</text>
      <!-- east reference and the direction arc -->
      <line x1={cx} y1={cy} x2={cx + 70} y2={cy} class="dg-tick" />
      {#if dist > 0}<path d={arcPath(cx, cy, 34, 0, dir)} class="dg-arc" marker-end="url(#{arrow})" />{/if}
      {@const [lx, ly] = polar(cx, cy, 52, dir / 2)}
      <text x={lx} y={ly + 4} text-anchor="middle" class="dg-value">{dir}°</text>
      {#if mode === "throw_at"}
        {@const [bx, by] = polar(cx, cy, burst * v.k, dir)}
        <line x1={cx} y1={cy} x2={bx} y2={by} class="dg-ray" marker-end="url(#{arrow})" />
        {#each R.splash as l (l.range)}<circle cx={bx} cy={by} r={l.range * v.k} class="dg-splash" />{/each}
      {:else}
        <line x1={cx} y1={cy} x2={v.sx(tx)} y2={v.sy(ty)} class="dg-ray" marker-end={mode === "drive" ? `url(#${arrow})` : undefined} />
      {/if}
      {@const mx = (cx + v.sx(tx)) / 2}
      {@const my = (cy + v.sy(ty)) / 2}
      <text x={mx - (dy >= 0 ? 8 : -8)} y={my - 8} text-anchor={dy >= 0 ? "end" : "start"} class="dg-value">{dist} m</text>
      <Robot {v} x={rx} y={ry} color={ROBOT_COLORS[0]} heading={mode === "drive" ? dir : null} />
      <Handle {v} bind:x={rx} bind:y={ry} color={ROBOT_COLORS[0]} label={it ? "Il tuo robot" : "Your robot"} />
      <Handle {v} bind:x={tx} bind:y={ty} r={8} color="var(--hot)" label={target} />
    {/snippet}
  </Plane>
  <div class="dg-out" aria-live="polite">
    {#if mode === "atan2"}
      <code>atan2({dy}, {dx}) = {dir}</code> · <code>sqrt({dx} * {dx} + {dy} * {dy}) = {dist}</code>
    {:else if mode === "drive"}
      <code>drive_to({tx}, {ty}, 100)</code> = <code>drive({dir}, 100)</code>
    {:else if mode === "throw_at"}
      <code>throw_at({tx}, {ty})</code> = <code>throw({dir}, {dist})</code>
      · {dist > R.throwRange ? (it ? `troppo lontano: scoppia a ${R.throwRange} m` : `too far: bursts at ${R.throwRange} m`) : (it ? "scoppia proprio lì" : "bursts right there")}
    {:else}
      <code>dir_to({tx}, {ty}) = {dir}</code> · <code>dist_to({tx}, {ty}) = {dist}</code>
    {/if}
  </div>
  <figcaption>
    {#if mode === "atan2"}
      {it ? "dx e dy sono i due lati corti di un triangolo rettangolo: atan2(dy, dx) dà l'angolo, il teorema di Pitagora (sqrt(dx² + dy²)) il lato lungo." : "dx and dy are the two short sides of a right triangle: atan2(dy, dx) gives the angle, Pythagoras' theorem (sqrt(dx² + dy²)) the long side."}
    {:else}
      {it ? "Trascina il robot (arancione) e il punto. La direzione si misura da est, in senso antiorario." : "Drag the robot (orange) and the point. The direction is measured from east, counterclockwise."}
    {/if}
  </figcaption>
</figure>
