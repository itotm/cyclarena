<script lang="ts">
  // Speed over time when a robot at full speed asks for a new direction: above
  // turnSpeed it cannot turn, so it slows down, turns and speeds up again.
  // Computed with the same rules as the game.
  import { RULES_V0 as R, type Lang } from "@paintarena/engine";

  let { lang }: { lang: Lang } = $props();
  const it = $derived(lang === "it");

  // simulation of the speed: at tick 0 the robot goes at 100% and calls drive(90, 100)
  const series = (() => {
    let speed = 100, heading = 0;
    const d = 90, pts: { t: number; s: number }[] = [{ t: 0, s: speed }];
    let turnAt = -1;
    for (let t = 1; t <= 16; t++) {
      if (heading !== d && speed <= R.turnSpeed) { heading = d; turnAt = t; }
      const target = heading !== d ? Math.min(100, R.turnSpeed) : 100;
      speed = speed < target ? Math.min(speed + R.accel, target) : Math.max(speed - R.accel, target);
      pts.push({ t, s: speed });
    }
    return { pts, turnAt };
  })();
  // braking from 100% to 0: ticks and metres covered meanwhile
  const braking = (() => {
    let speed = 100, mm = 0, ticks = 0;
    while (speed > 0) { speed = Math.max(0, speed - R.accel); mm += Math.floor((speed * R.robotMaxStep) / 100); ticks++; }
    return { ticks, metres: Math.round(mm / 1000) };
  })();

  const W = 440, H = 200, L = 40, B = 30, T = 14, Rt = 12;
  const x = (t: number) => L + (t / 16) * (W - L - Rt);
  const y = (s: number) => T + (1 - s / 100) * (H - T - B);
</script>

<figure class="dg-figure">
  <svg class="dg block h-auto w-full" viewBox="0 0 {W} {H}" role="img"
    aria-label={it ? "Grafico della velocità: scende da 100 a 50, il robot gira, poi risale a 100" : "Speed chart: it drops from 100 to 50, the robot turns, then it goes back up to 100"}>
    {#each [0, 50, 100] as s (s)}
      <line x1={L} x2={W - Rt} y1={y(s)} y2={y(s)} class={s === R.turnSpeed ? "dg-guide" : "dg-grid"} />
      <text x={L - 6} y={y(s) + 4} text-anchor="end" class="dg-small">{s}%</text>
    {/each}
    {#each [0, 4, 8, 12, 16] as t (t)}
      <text x={x(t)} y={H - B + 16} text-anchor="middle" class="dg-small">{t}</text>
    {/each}
    <text x={W - Rt} y={H - 2} text-anchor="end" class="dg-small">tick</text>
    <line x1={x(series.turnAt)} x2={x(series.turnAt)} y1={T} y2={H - B} class="dg-guide" />
    <text x={x(series.turnAt) + 5} y={T + 10} class="dg-value">{it ? "gira qui" : "turns here"}</text>
    <polyline points={series.pts.map((p) => `${x(p.t)},${y(p.s)}`).join(" ")} class="dg-line" />
    {#each series.pts as p (p.t)}<circle cx={x(p.t)} cy={y(p.s)} r="2.5" class="dg-fill-accent" />{/each}
  </svg>
  <figcaption>
    {it
      ? `A tutta velocità il robot chiama drive(90, 100): sopra il ${R.turnSpeed}% non può girare, quindi rallenta di ${R.accel} punti a tick, gira e riaccelera. Per fermarsi da 100 a 0 servono ${braking.ticks} tick, in cui fa ancora circa ${braking.metres} metri.`
      : `At full speed the robot calls drive(90, 100): above ${R.turnSpeed}% it can't turn, so it slows down by ${R.accel} points per tick, turns and speeds up again. Stopping from 100 to 0 takes ${braking.ticks} ticks, while it still covers about ${braking.metres} metres.`}
  </figcaption>
</figure>
