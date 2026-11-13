<script lang="ts">
  import { onDestroy } from "svelte";
  // In-browser tournament: thousands of matches between the chosen robots,
  // played in parallel, with standings, head-to-head results and charts.
  import { compile, message, POINTS_SURVIVE, POINTS_WIN, ROBOT_CLASSES, rulesForClass, tournamentGroups, type RobotClassId, type TournamentStats } from "@paintarena/engine";
  import { i18n } from "./i18n.svelte.ts";
  import { allRefs, library, resolveRef, sampleRef, type RobotRef } from "./library.svelte.ts";
  import { samples } from "./samples.ts";
  import { load, save } from "./storage.ts";
  import { runTournament, threadCount } from "./tournament/runner.ts";
  import LineChart from "./tournament/LineChart.svelte";
  import Histogram from "./tournament/Histogram.svelte";
  import Heatmap from "./tournament/Heatmap.svelte";

  const t = i18n.t;
  const PRESETS = [1_000, 10_000, 100_000];
  const MAX_MATCHES = 10_000_000;
  const HISTORY_POINTS = 240;

  // --- settings (remembered between visits) ---
  function savedJson<T>(key: string, ok: (v: unknown) => boolean, fallback: T): T {
    try { const v = JSON.parse(load(key) ?? ""); if (ok(v)) return v as T; } catch { /* nothing */ }
    return fallback;
  }
  let selected = $state<RobotRef[]>(savedJson("tournament.robots", Array.isArray,
    samples().filter((s) => s.id !== "first").map((s) => sampleRef(s.id))).filter((r: RobotRef) => resolveRef(r)));
  const savedClass = load("tournament.class");
  let klass = $state<RobotClassId>(ROBOT_CLASSES.some((c) => c.id === savedClass) ? (savedClass as RobotClassId) : "standard");
  let size = $state<number>(savedJson("tournament.size", (v) => v === 2 || v === 3 || v === 4, 2));
  let preset = $state<number>(savedJson("tournament.preset", (v) => v === 0 || PRESETS.includes(v as number), 10_000));
  let custom = $state<number>(savedJson("tournament.custom", (v) => typeof v === "number" && v > 0, 50_000));
  let seed = $state(Math.floor(Math.random() * 1_000_000));

  const rules = $derived(rulesForClass(klass));
  const matches = $derived(Math.max(1, Math.min(MAX_MATCHES, Math.floor(preset || custom || 1))));

  // available robots, with the compilation result in the chosen class
  const entries = $derived(allRefs().map((ref) => {
    const r = resolveRef(ref)!;
    const c = compile(r.source, rules);
    const err = c.diagnostics.find((d) => d.severity === "error");
    return { ref, name: r.name, user: r.user, ok: c.ok, why: err ? message(err.code, err.args, i18n.lang) : "" };
  }));
  const usable = $derived(entries.filter((e) => e.ok && selected.includes(e.ref)));
  const groupCount = $derived(usable.length >= size ? tournamentGroups(usable.length, size).length : 0);

  function toggle(ref: RobotRef, on: boolean) {
    selected = on ? [...selected, ref] : selected.filter((r) => r !== ref);
  }

  // --- running ---
  interface Run {
    names: string[];
    colors: string[];
    total: number;
    size: number;
    maxTicks: number;
    className: string;
  }
  let run = $state.raw<Run | null>(null);
  let stats = $state.raw<TournamentStats | null>(null);
  let done = $state(0);
  let seconds = $state(0);
  let running = $state(false);
  let history = $state.raw<{ done: number; values: number[] }[]>([]);
  let stopFn: (() => void) | null = null;

  const fmt = (n: number) => new Intl.NumberFormat(i18n.lang).format(n);
  const pct = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");
  const color = (k: number) => (k < 8 ? `var(--series-${k + 1})` : "var(--series-other)");

  function start() {
    if (running || usable.length < size) return;
    save("tournament.robots", JSON.stringify(selected));
    save("tournament.class", klass);
    save("tournament.size", String(size));
    save("tournament.preset", String(preset));
    save("tournament.custom", String(custom));
    const list = usable;
    // identical names (a sample and its copy): they get numbered
    const names: string[] = [];
    for (const e of list) {
      const same = names.filter((n) => n === e.name || n.startsWith(e.name + " #")).length;
      names.push(same ? `${e.name} #${same + 1}` : e.name);
    }
    run = {
      names,
      colors: list.map((_, k) => color(k)),
      total: matches,
      size,
      maxTicks: rules.maxTicks,
      className: message("CLASS_" + klass, [], i18n.lang),
    };
    stats = null;
    done = 0;
    seconds = 0;
    history = [];
    running = true;
    const handle = runTournament(
      { sources: list.map((e) => resolveRef(e.ref)!.source), rules, size, matches, seed },
      (p) => {
        // shallow copy: the statistics change in place
        stats = { ...p.stats };
        done = p.done;
        seconds = p.seconds;
        const values = p.stats.played.map((pl, k) => (pl ? (p.stats.wins[k] / pl) * 100 : 0));
        let h = [...history, { done: p.done, values }];
        // at most HISTORY_POINTS points: if there are too many, every other one is kept
        if (h.length > HISTORY_POINTS) h = h.filter((_, i) => i % 2 === 0 || i === h.length - 1);
        history = h;
      },
    );
    stopFn = handle.stop;
    handle.finished.then(() => { running = false; stopFn = null; });
  }

  function stop() {
    stopFn?.();
  }
  // leaving the page stops the threads: otherwise they keep running unseen
  // (and a new tournament would add more)
  onDestroy(stop);

  // --- standings ---
  const table = $derived.by(() => {
    if (!run || !stats) return [];
    const s = stats;
    return run.names.map((name, k) => {
      const pl = s.played[k] || 1;
      return {
        k, name,
        played: s.played[k],
        wins: s.wins[k], ties: s.ties[k], losses: s.played[k] - s.wins[k] - s.ties[k],
        ppm: s.points[k] / pl,
        win: (s.wins[k] / pl) * 100,
        place: s.place[k] / pl,
        paint: s.paint[k] / pl,
      };
    }).sort((a, b) => b.ppm - a.ppm || b.win - a.win || a.k - b.k);
  });
  const order = $derived(table.map((r) => r.k));
  const bestWin = $derived(Math.max(1, ...table.map((r) => r.win)));

  const rate = $derived(seconds > 0 ? done / seconds : 0);
  const eta = $derived(running && rate > 0 && run ? (run.total - done) / rate : 0);
  const avgTicks = $derived(stats && stats.matches ? stats.ticksSum / stats.matches : 0);
  const timeoutPct = $derived(stats && stats.matches ? (stats.timeouts / stats.matches) * 100 : 0);

  function duration(s: number): string {
    if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
    return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  }
</script>

<div class="grid min-h-0 grid-cols-1 gap-3 xl:h-full xl:grid-cols-[21rem_minmax(0,1fr)]">
  <!-- settings -->
  <section class="panel flex min-h-0 flex-col gap-3 p-3">
    <h2 class="panel-title text-[0.8rem] text-ink">{t("tournamentSetup")}</h2>

    <div class="flex min-h-0 flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="label-tech">{t("tRobots")} ({usable.length})</span>
        <span class="flex gap-3 text-xs">
          <button class="btn-link" onclick={() => (selected = entries.filter((e) => e.ok).map((e) => e.ref))} disabled={running}>{t("all")}</button>
          <button class="btn-link" onclick={() => (selected = [])} disabled={running}>{t("noneSel")}</button>
        </span>
      </div>
      <div class="max-h-80 min-h-24 overflow-y-auto rounded-xs border border-line bg-bg/40 py-1 xl:max-h-none xl:flex-1">
        {#each [true, false] as user (user)}
          <div class="px-2 pt-1 pb-0.5 font-tech text-[0.65rem] uppercase tracking-[0.12em] text-dim">{user ? t("myRobots") : t("examples")}</div>
          {#each entries.filter((e) => e.user === user) as e (e.ref)}
            <label class={["flex cursor-pointer items-center gap-2 px-2 py-0.5 text-sm hover:bg-surface-2", !e.ok && "cursor-not-allowed opacity-50"]}
              title={e.ok ? "" : e.why}>
              <input type="checkbox" class="accent-accent" checked={e.ok && selected.includes(e.ref)} disabled={!e.ok || running}
                onchange={(ev) => toggle(e.ref, ev.currentTarget.checked)} />
              <span class="truncate">{e.name}</span>
              {#if !e.ok}<span class="ml-auto text-xs text-bad">{t("notInClass")}</span>{/if}
            </label>
          {/each}
        {/each}
      </div>
    </div>

    <label class="flex items-center justify-between gap-2" title={t("classHint")}>
      <span class="label-tech">{t("robotClass")}</span>
      <select bind:value={klass} disabled={running}>
        {#each ROBOT_CLASSES as c (c.id)}<option value={c.id}>{message("CLASS_" + c.id, [], i18n.lang)}</option>{/each}
      </select>
    </label>

    <div class="flex flex-col gap-1">
      <span class="label-tech">{t("perMatch")}</span>
      <div class="grid grid-cols-3" role="radiogroup" aria-label={t("perMatch")}>
        {#each [2, 3, 4] as k (k)}
          <button role="radio" aria-checked={size === k} disabled={running}
            class={["not-first:-ml-px text-sm", size === k && "relative border-accent bg-accent-soft text-accent"]}
            onclick={() => (size = k)}>{k === 2 ? t("duel") : t("robotsN", k)}</button>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <span class="label-tech">{t("matchCount")}</span>
      <div class="grid grid-cols-4" role="radiogroup" aria-label={t("matchCount")}>
        {#each [...PRESETS, 0] as p (p)}
          <button role="radio" aria-checked={preset === p} disabled={running}
            class={["not-first:-ml-px font-mono text-sm", preset === p && "relative border-accent bg-accent-soft text-accent"]}
            onclick={() => (preset = p)}>{p ? fmt(p) : t("customN")}</button>
        {/each}
      </div>
      {#if preset === 0}
        <input class="font-mono" type="number" min="1" max={MAX_MATCHES} step="1000" bind:value={custom} disabled={running} aria-label={t("matchCount")} />
      {/if}
    </div>

    <div class="flex items-center justify-between gap-2">
      <label class="label-tech" for="tournament-seed">{t("seed")}</label>
      <span class="flex items-center gap-1.5">
        <input id="tournament-seed" class="w-28 font-mono text-sm" type="number" bind:value={seed} disabled={running} />
        <button class="grid size-8 place-items-center p-0" onclick={() => (seed = Math.floor(Math.random() * 1_000_000))} disabled={running} title={t("newSeed")} aria-label={t("newSeed")}>
          <svg viewBox="0 0 16 16" aria-hidden="true" class="size-3.5"><path d="M13.3 6.2A5.5 5.5 0 1 0 13.5 10" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M14 2.5v4.2H9.8z" fill="currentColor" /></svg>
        </button>
      </span>
    </div>

    <p class="m-0 text-xs leading-relaxed text-muted">
      {#if usable.length < size}
        <span class="text-bad">{t("needRobots", size)}</span>
      {:else}
        {t("groupsInfo", fmt(groupCount), fmt(Math.floor(matches / groupCount)), threadCount())}
      {/if}
    </p>

    {#if running}
      <button class="w-full" onclick={stop}>{t("stop")}</button>
    {:else}
      <button class="btn-primary w-full" onclick={start} disabled={usable.length < size}>{t("startTournament")}</button>
    {/if}
  </section>

  <!-- results -->
  <section class="flex min-h-0 min-w-0 flex-col gap-3">
    {#if !run}
      <div class="panel flex flex-1 flex-col justify-center gap-3 p-8 text-muted">
        <h2 class="m-0 text-xl text-ink">{t("tournamentTitle")}</h2>
        <p class="m-0 max-w-[44rem] leading-relaxed">{t("tournamentIntro")}</p>
        <p class="m-0 max-w-[44rem] leading-relaxed">{t("tournamentPoints", POINTS_WIN, POINTS_SURVIVE)}</p>
      </div>
    {:else}
      <!-- status -->
      <div class="panel flex flex-none flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 text-sm">
        <span class="font-tech font-semibold tracking-wide">
          {fmt(done)} / {fmt(run.total)} {t("matchesWord")}
        </span>
        <span class="h-1 min-w-24 flex-1 overflow-hidden bg-surface-3">
          <span class="block h-full bg-accent transition-[width]" style:width="{(done / run.total) * 100}%"></span>
        </span>
        <span class="font-mono text-xs text-muted">{fmt(Math.round(rate))} {t("perSecond")}</span>
        <span class="font-mono text-xs text-muted">{duration(seconds)}{#if running && eta > 0} · {t("etaLeft", duration(eta))}{/if}</span>
        <span class="font-mono text-xs text-muted">{run.size === 2 ? t("duel") : t("robotsN", run.size)} · {run.className} · {t("avgTicks", fmt(Math.round(avgTicks)))} · {t("timeouts", pct(timeoutPct))}</span>
        {#if !running && done < run.total}<span class="text-xs text-hot">{t("stopped")}</span>{/if}
      </div>

      <!-- standings -->
      <div class="panel min-h-32 flex-[0_1_auto] overflow-auto xl:max-h-[45%]">
        <table class="w-full border-collapse text-sm">
          <thead class="sticky top-0 bg-surface">
            <tr class="border-b border-line-strong text-left">
              {#each [["#", ""], [t("tRobot"), ""], [t("pointsPerMatch"), t("pointsHint", POINTS_WIN, POINTS_SURVIVE)], [t("winRate"), ""], [t("wtl"), ""], [t("avgPlace"), t("avgPlaceHint")], [t("avgPaint"), t("avgPaintHint")]] as [label, hint], i (i)}
                <th class={["px-2.5 py-1.5 font-tech text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted", i !== 1 && i !== 3 && "text-right"]} title={hint}>{label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each table as r, i (r.k)}
              <tr class="border-b border-line">
                <td class="px-2.5 py-1 text-right font-mono text-xs text-dim">{i + 1}</td>
                <td class="max-w-56 px-2.5 py-1"><span class="flex min-w-0 items-center gap-2"><span class="diamond size-[7px]" style:--c={run.colors[r.k]}></span><span class="truncate font-tech font-semibold">{r.name}</span></span></td>
                <td class="px-2.5 py-1 text-right font-mono tabular-nums">{r.ppm.toFixed(2)}</td>
                <td class="w-[30%] px-2.5 py-1">
                  <span class="flex items-center gap-2">
                    <span class="h-2 flex-1"><span class="block h-full rounded-r-[3px] bg-accent" style:width="{(r.win / bestWin) * 100}%"></span></span>
                    <span class="w-14 text-right font-mono text-xs tabular-nums">{pct(r.win)}%</span>
                  </span>
                </td>
                <td class="px-2.5 py-1 text-right font-mono text-xs tabular-nums text-muted">{fmt(r.wins)} / {fmt(r.ties)} / {fmt(r.losses)}</td>
                <td class="px-2.5 py-1 text-right font-mono text-xs tabular-nums">{r.place.toFixed(2)}</td>
                <td class="px-2.5 py-1 text-right font-mono text-xs tabular-nums">{pct(r.paint, 0)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- charts -->
      {#if stats}
        <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
          <div class="panel flex min-h-64 flex-col gap-1.5 p-3">
            <h3 class="panel-title">{t("headToHead")}</h3>
            <p class="m-0 text-xs text-dim">{t("headToHeadHint")}</p>
            <div class="min-h-0 flex-1">
              <Heatmap {order} names={run.names} colors={run.colors} n={stats.robots} ahead={stats.ahead} meetings={stats.meetings}
                label={t("headToHead")} tip={(a, b, p, g) => t("h2hTip", a, b, pct(p, 0), fmt(g))} />
            </div>
          </div>
          <div class="panel flex min-h-64 flex-col gap-1.5 p-3">
            <h3 class="panel-title">{t("winTrend")}</h3>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
              {#each order as k (k)}
                <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full" style:background={run.colors[k]}></span>{run.names[k]}</span>
              {/each}
            </div>
            <div class="min-h-0 flex-1">
              <LineChart {history} names={run.names} colors={run.colors} {order} xLabel={t("matchesWord")} {fmt} />
            </div>
          </div>
          <div class="panel flex min-h-64 flex-col gap-1.5 p-3">
            <h3 class="panel-title">{t("durations")}</h3>
            <p class="m-0 text-xs text-dim">{t("durationsHint")}</p>
            <div class="min-h-0 flex-1">
              <Histogram bins={stats.ticksHist} maxTicks={run.maxTicks} {fmt} label={t("durations")}
                tip={(a, b, c, s) => t("durTip", fmt(a), fmt(b), fmt(c), pct(s))} />
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </section>
</div>
