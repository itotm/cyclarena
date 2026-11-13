<script lang="ts">
  // The radar: a cone of ±res degrees around dir. It returns the distance of
  // the nearest robot inside the cone, 0 if there is none. The other robots
  // can be dragged.
  import { BUILTINS, iatan2, idist, RULES_V0, type Lang } from "@paintarena/engine";
  import Plane from "../Plane.svelte";
  import Handle from "../Handle.svelte";
  import Robot from "../Robot.svelte";
  import { polar, ROBOT_COLORS, sectorPath } from "../geom.ts";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");
  const ME = { x: 250, y: 320 };
  let dir = $state(30), res = $state(10);
  let ax = $state(720), ay = $state(560), bx = $state(640), by = $state(170);
  const scanCost = BUILTINS.find((b) => b.name === "scan")!.cost;

  /** Same test as the game: angle difference within res, distance in whole metres. */
  function seen(x: number, y: number): number {
    const dx = x - ME.x, dy = y - ME.y;
    const diff = Math.abs((((iatan2(dy, dx) - dir) % 360) + 540) % 360 - 180);
    return diff <= res ? Math.max(1, idist(dx, dy)) : 0;
  }
  const da = $derived(seen(ax, ay)), db = $derived(seen(bx, by));
  const result = $derived(da && db ? Math.min(da, db) : da || db);
</script>

<figure class="dg-figure">
  <Plane w={1000} h={1000} width={440} label={it ? "Il cono del radar" : "The radar cone"}>
    {#snippet children(v)}
      {@const cx = v.sx(ME.x)}
      {@const cy = v.sy(ME.y)}
      <rect width={v.width} height={v.height} class="dg-arena" />
      {#if res > 0}
        <path d={sectorPath(cx, cy, 1500 * v.k, dir - res, dir + res)} class="dg-cone" />
      {:else}
        {@const [ex, ey] = polar(cx, cy, 1500 * v.k, dir)}
        <line x1={cx} y1={cy} x2={ex} y2={ey} class="dg-cone-line" />
      {/if}
      {@const [gx, gy] = polar(cx, cy, 1500 * v.k, dir)}
      <line x1={cx} y1={cy} x2={gx} y2={gy} class="dg-guide" />
      {#if result}
        {@const target = result === da ? { x: ax, y: ay } : { x: bx, y: by }}
        <line x1={cx} y1={cy} x2={v.sx(target.x)} y2={v.sy(target.y)} class="dg-ray" />
      {/if}
      <Robot {v} x={ME.x} y={ME.y} color={ROBOT_COLORS[0]} heading={dir} />
      <Robot {v} x={ax} y={ay} color={ROBOT_COLORS[1]} dim={!da} label={da ? `${da} m` : ""} r={12} />
      <Robot {v} x={bx} y={by} color={ROBOT_COLORS[2]} dim={!db} label={db ? `${db} m` : ""} r={12} />
      <Handle {v} bind:x={ax} bind:y={ay} color={ROBOT_COLORS[1]} label={it ? "Robot blu" : "Blue robot"} r={12} />
      <Handle {v} bind:x={bx} bind:y={by} color={ROBOT_COLORS[2]} label={it ? "Robot verde" : "Green robot"} r={12} />
    {/snippet}
  </Plane>
  <div class="dg-controls">
    <label>dir <input type="range" min="0" max="359" bind:value={dir} /> <output>{dir}</output></label>
    <label>res <input type="range" min="0" max={RULES_V0.scanMaxRes} bind:value={res} /> <output>{res}</output></label>
  </div>
  <div class="dg-out" aria-live="polite">
    <code>scan({dir}, {res}) = {result}</code> · <span>{it ? "costo" : "cost"} {scanCost} + 2 × {res} = {scanCost + 2 * res} {it ? "cicli" : "cycles"}</span>
  </div>
  <figcaption>{it ? "Sposta i robot e cambia direzione e ampiezza del cono. Il radar dice solo la distanza del più vicino nel cono: non quale robot è, né dove sia esattamente dentro il cono." : "Move the robots and change the direction and width of the cone. The radar only tells the distance of the nearest one in the cone: not which robot it is, nor where exactly in the cone it is."}</figcaption>
</figure>
