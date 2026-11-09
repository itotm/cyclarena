<script lang="ts">
  import { compile, message, MIN_STACK, recordMatch, ROBOT_CLASSES, rulesForClass, smallestClass, type Entrant, type Replay, type RobotClassId } from "@paintarena/engine";
  import Editor, { type CostInfo } from "./Editor.svelte";
  import Arena from "./Arena.svelte";
  import RichText from "./RichText.svelte";
  import { i18n } from "./i18n.svelte.ts";
  import { samples, sample } from "./samples.ts";
  import { library, resolveRef, sampleRef, userRef, type RobotRef } from "./library.svelte.ts";
  import RobotBar from "./RobotBar.svelte";
  import { load, save } from "./storage.ts";
  import { MISSIONS, missionOpponents, missionRules, playMission, type Mission } from "./missions.ts";
  import { progress } from "./progress.svelte.ts";
  import { theme } from "./theme.svelte.ts";
  import { STAIN_TICKS, WALL_PAINT, type Hit } from "./robotArt.ts";

  interface Props {
    /** Current mission, or null for free play. */
    mission: Mission | null;
    onopen: (id: string | null) => void;
  }
  let { mission, onopen }: Props = $props();

  const COLORS = ["#ff7a1a", "#2f9bff", "#1fcf8c", "#b46bff"];
  const TICKS_PER_SECOND = 30;
  const SPEEDS = [1, 2, 5, 10, 30];
  const t = i18n.t;

  // --- code: in free play that of the robot chosen in the library,
  // in missions one per mission (the component is recreated when the
  // mission changes) ---
  // svelte-ignore state_referenced_locally
  const m = mission;
  const sourceKey = m ? "mission." + m.id : "";
  const starter = () => (m && m.starter[i18n.lang]) || sample("first")!.source;
  let source = $state(m ? (load(sourceKey) ?? starter()) : library.current.source);
  // class (code and memory limits): chosen in free play, Standard in missions
  const savedClass = load("class");
  let klass = $state<RobotClassId>(ROBOT_CLASSES.some((c) => c.id === savedClass) ? (savedClass as RobotClassId) : "standard");
  const rules = $derived(m ? missionRules(m) : rulesForClass(klass));
  const compiled = $derived(compile(source, rules));
  const fits = $derived(compiled.program ? smallestClass(compiled.program.size, compiled.program.globals) : null);
  // samples compiled in the chosen class: those that do not fit cannot be chosen
  const errorCount = $derived(compiled.diagnostics.filter((d) => d.severity === "error").length);
  const warningCount = $derived(compiled.diagnostics.length - errorCount);
  const firstError = $derived(compiled.diagnostics.find((d) => d.severity === "error"));

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    // save the code on every change (delayed)
    const s = source;
    if (!m) { library.setSource(library.currentId, s); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(sourceKey, s), 400);
    return () => clearTimeout(saveTimer);
  });

  // robot changed in the library: the editor restarts with its code
  function onLibraryChange() {
    source = library.current.source;
  }

  // --- participants: 2 to 4, chosen among one's own robots and the samples ---
  // "e" means the robot open in the editor, whichever it is
  const EDITOR: RobotRef = "e";
  function savedSlots(): RobotRef[] {
    const valid = (r: unknown) => typeof r === "string" && (r === "" || r === EDITOR || !!resolveRef(r));
    try {
      const v = JSON.parse(load("participants") ?? "");
      if (Array.isArray(v) && v.length === 4 && v.every(valid) && v.filter(Boolean).length) return v;
    } catch { /* value missing or corrupted */ }
    return [EDITOR, sampleRef("sprinkler"), sampleRef("wanderer"), ""];
  }
  let slots = $state<RobotRef[]>(savedSlots());

  function refSource(ref: RobotRef) {
    if (ref === EDITOR) return { name: library.current.name, source };
    return resolveRef(ref);
  }
  // compile the robots in the chosen class (cached: sources rarely change)
  const okCache = new Map<string, boolean>();
  function fitsRules(src: string): boolean {
    if (okCache.size > 500) okCache.clear();
    const key = rules.robotClass + "\u0000" + src;
    let ok = okCache.get(key);
    if (ok === undefined) okCache.set(key, (ok = compile(src, rules).ok));
    return ok;
  }
  const slotOk = $derived(slots.map((ref) => {
    if (!ref) return false;
    if (ref === EDITOR) return compiled.ok;
    const r = resolveRef(ref);
    return !!r && fitsRules(r.source);
  }));
  const readyCount = $derived(slotOk.filter(Boolean).length);
  let matchColors = $state.raw<string[]>(COLORS);
  let notice = $state("");
  let dragging = $state(false);
  // notices (imported robots, etc.) stay a few seconds in place of the code status
  $effect(() => {
    if (!notice) return;
    const id = setTimeout(() => (notice = ""), 4000);
    return () => clearTimeout(id);
  });

  async function dropFiles(e: DragEvent) {
    dragging = false;
    if (m || !e.dataTransfer?.files.length) return;
    e.preventDefault();
    const { added, skipped } = await library.importFiles(e.dataTransfer.files);
    onLibraryChange();
    notice = [added.length ? t("imported", added.join(", ")) : "", skipped.length ? t("importSkipped", skipped.join(", ")) : ""].filter(Boolean).join(" · ");
  }
  let editorIndex = $state(0);
  let seed = $state(m && !m.randomSeed ? 1 : Math.floor(Math.random() * 1_000_000));
  let replay = $state.raw<Replay | null>(null);
  let replaySource = "";
  let missionOk = $state<boolean | null>(null);
  let tick = $state(0);
  let playing = $state(false);
  let speed = $state(Number(load("speed") ?? 1));
  let hintsShown = $state(0);

  const frame = $derived(replay ? replay.frames[Math.min(tick, replay.frames.length - 1)] : null);
  const lastTick = $derived(replay ? replay.frames.length - 1 : 0);
  const names = $derived(replay ? replay.names : [m ? t("myRobot") : library.current.name]);
  const atEnd = $derived(!!replay && tick >= lastTick);

  function fight() {
    if (m) {
      if (!compiled.ok) return;
      const me: Entrant = { name: t("myRobot"), program: compiled.program! };
      matchColors = COLORS;
      editorIndex = 0;
      if (m.randomSeed) seed = Math.floor(Math.random() * 1_000_000);
      const others = missionOpponents(m, i18n.lang, (id) => sample(id)?.source);
      replay = playMission(m, [me, ...others], seed, true);
      missionOk = m.check(replay);
    } else {
      const entrants: Entrant[] = [], colors: string[] = [];
      editorIndex = -1;
      slots.forEach((ref, i) => {
        const r = ref ? refSource(ref) : null;
        if (!r || !slotOk[i]) return;
        if (editorIndex < 0 && (ref === EDITOR || ref === userRef(library.currentId))) editorIndex = entrants.length;
        const c = ref === EDITOR || r.source === source ? compiled : compile(r.source, rules);
        // identical names (the same robot twice): they get numbered
        const same = entrants.filter((e) => e.name === r.name || e.name.startsWith(r.name + " #")).length;
        entrants.push({ name: same ? `${r.name} #${same + 1}` : r.name, program: c.program! });
        colors.push(COLORS[i]);
      });
      if (entrants.length < 2) return;
      save("participants", JSON.stringify(slots));
      matchColors = colors;
      replay = recordMatch(entrants, { seed, profile: true, rules });
    }
    replaySource = source;
    tick = 0;
    playing = true;
  }

  // the mission counts as completed only when the replay reaches the end (no spoilers)
  $effect(() => {
    if (m && missionOk && atEnd) progress.complete(m.id);
  });

  // timed playback of the match, with requestAnimationFrame
  $effect(() => {
    if (!playing || !replay) return;
    const end = replay.frames.length - 1;
    let last = performance.now(), acc = 0, raf = 0;
    const loop = (now: number) => {
      acc += ((now - last) / 1000) * TICKS_PER_SECOND * speed;
      last = now;
      const n = Math.floor(acc);
      if (n > 0) {
        acc -= n;
        tick = Math.min(tick + n, end);
        if (tick >= end) { playing = false; return; }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function togglePlay() {
    if (!replay) return;
    if (tick >= lastTick) tick = 0;
    playing = !playing;
  }

  // --- console: messages up to the current tick ---
  interface LogEntry { id: number; tick: number; robot: number; text: string; kind: "print" | "error" | "info" }
  const log = $derived.by((): LogEntry[] => {
    if (!replay) return [];
    const out: LogEntry[] = [];
    let id = 0;
    for (const f of replay.frames) {
      for (const e of f.events) {
        if (e.t === "print") out.push({ id: id++, tick: f.tick, robot: e.robot, text: e.text, kind: "print" });
        else if (e.t === "error") out.push({ id: id++, tick: f.tick, robot: e.robot, kind: "error", text: message("R_RESTART", [{ code: e.code, args: e.args }, e.line], i18n.lang) });
        else if (e.t === "out") out.push({ id: id++, tick: f.tick, robot: e.robot, kind: "info", text: t("wentOut") });
        else if (e.t === "halt") out.push({ id: id++, tick: f.tick, robot: e.robot, kind: "info", text: message("R_HALT", [], i18n.lang) });
      }
    }
    return out;
  });
  const visibleLog = $derived.by(() => {
    let n = 0;
    while (n < log.length && log[n].tick <= tick) n++;
    return log.slice(Math.max(0, n - 200), n);
  });

  function scrollToEnd(node: HTMLElement) {
    void visibleLog.length; // reruns when new messages arrive
    node.scrollTop = node.scrollHeight;
  }

  // --- paint: every hit received, and the splashes on the floor ---
  const paintEvents = $derived.by(() => {
    const hits: { tick: number; by: number; a: number }[][] = replay ? replay.names.map(() => []) : [];
    const splashes: { tick: number; owner: number; x: number; y: number; seed: number }[] = [];
    if (replay) for (const f of replay.frames) for (const e of f.events) {
      if (e.t === "paint") hits[e.robot].push({ tick: f.tick, by: e.by, a: e.amount });
      else if (e.t === "splash") splashes.push({ tick: f.tick, owner: e.robot, x: e.x / 1000, y: e.y / 1000, seed: f.tick * 7 + e.robot + 1 });
    }
    return { hits, splashes };
  });
  const hits = $derived<Hit[][]>(paintEvents.hits.map((list) => list.filter((h) => h.tick <= tick)));
  const stains = $derived(paintEvents.splashes.filter((st) => st.tick <= tick && tick - st.tick < STAIN_TICKS)
    .map((st) => ({ ...st, age: tick - st.tick })));

  const marks = $derived.by(() => {
    if (!replay) return [];
    const out: { robot: number; x: number; y: number }[] = [];
    for (let k = Math.max(0, tick - 20); k <= tick && k < replay.frames.length; k++)
      for (const e of replay.frames[k].events) if (e.t === "mark") out.push({ robot: e.robot, x: e.x, y: e.y });
    return out;
  });

  const resultText = $derived.by(() => {
    if (!replay || !atEnd || m) return "";
    const r = replay.result;
    return r.reason === "victory" ? t("winner", replay.names[r.winner]) : r.reason === "draw" ? t("draw") : t("timeout");
  });

  const missionText = $derived.by(() => {
    if (!m || !replay || !atEnd || missionOk === null) return "";
    if (missionOk) return t("success");
    const me = replay.frames[replay.frames.length - 1].robots[0];
    return me.out ? t("failOut") : replay.result.reason === "timeout" ? t("failTimeout", replay.result.ticks) : t("failGeneric");
  });

  const cyclesLastTick = $derived.by(() => {
    if (!replay || !frame || tick === 0) return frame?.robots.map(() => 0) ?? [];
    const prev = replay.frames[tick - 1];
    return frame.robots.map((r, i) => r.cycles - prev.robots[i].cycles);
  });

  // --- profile: where the user's robot spends its cycles ---
  const profile = $derived.by(() => {
    const prof = editorIndex >= 0 ? replay?.profiles[editorIndex] : null;
    if (!replay || !prof || source !== replaySource || !compiled.ok) return null;
    const p = compiled.program!;
    const perLine = new Float64Array(p.lineCost.length);
    let total = 0;
    for (let pc = 0; pc < p.size; pc++) { perLine[p.lines[pc]] += prof[pc]; total += prof[pc]; }
    if (!total) return null;
    const heat = perLine.map((v) => v / total);
    const lines = source.split("\n");
    const top = [...heat.keys()].filter((l) => heat[l] > 0).sort((a, b) => heat[b] - heat[a]).slice(0, 5)
      .map((l) => ({ line: l, share: heat[l], code: (lines[l - 1] ?? "").trim() }));
    return { heat, top };
  });

  const costs = $derived<CostInfo>(
    compiled.ok
      ? { cost: compiled.program!.lineCost, dynamic: compiled.program!.lineDynamic, heat: profile?.heat ?? null }
      : { cost: null, dynamic: null, heat: null },
  );



  // --- sizes: on a wide screen everything must stay in view ---
  let innerWidth = $state(1920);
  let slotW = $state(0), slotH = $state(0);
  const wide = $derived(innerWidth >= 1280);
  const remPx = 16;
  const arenaSize = $derived.by(() => {
    if (!wide) return Math.max(240, Math.min(slotW, 900));
    // space left free by the side columns at their minimum width
    const maxByWidth = innerWidth - 2 * 12 - 2 * 12 - (24 + 17) * remPx;
    return Math.max(240, Math.floor(Math.min(slotH, maxByWidth)));
  });

  const index = $derived(m ? MISSIONS.indexOf(m) : -1);
  const next = $derived(index >= 0 && index + 1 < MISSIONS.length ? MISSIONS[index + 1] : null);
</script>

<svelte:window bind:innerWidth />

{#snippet usage(label: string, used: number, max: number)}
  {@const unlimited = max >= 100_000}
  {@const pct = unlimited ? 0 : Math.round((used / max) * 100)}
  <span class={["inline-flex items-center gap-1.5 font-mono text-xs", pct >= 80 ? "text-hot" : "text-muted"]}
    title="{label}: {used} / {unlimited ? '∞' : max}">
    {label} {used}/{unlimited ? "∞" : max}
    {#if !unlimited}
      <span class="inline-block h-[3px] w-18 overflow-hidden bg-surface-3">
        <span class={["block h-full", pct >= 80 ? "bg-hot" : "bg-accent"]} style:width="{Math.min(100, Math.max(pct, 2))}%"></span>
      </span>
    {/if}
  </span>
{/snippet}

<div class="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:h-full xl:grid-cols-[minmax(24rem,1fr)_var(--arena)_minmax(17rem,24rem)]"
  style:--arena="{arenaSize}px">
  <!-- editor -->
  <section class="flex min-h-0 min-w-0 flex-col gap-2">
    {#if m}
      <div class="flex min-h-8 flex-wrap items-center gap-2.5">
        <h2 class="panel-title text-[0.8rem] text-ink" style:--mk={COLORS[0]}>{t("myRobot")}</h2>
        <button class="px-2.5 py-0.5 text-xs" onclick={() => (source = starter())}>{t("resetCode")}</button>
        <span class="text-xs text-dim">{t("undoHint")}</span>
      </div>
    {:else}
      <RobotBar onchange={onLibraryChange} onnotice={(text) => (notice = text)} />
    {/if}
    <div class={["relative h-[70vh] xl:h-auto xl:min-h-0 xl:flex-1", dragging && "outline outline-dashed outline-accent"]}
      role="region" aria-label={t("editorLabel")}
      ondragover={(e) => { if (!m && e.dataTransfer?.types.includes("Files")) { e.preventDefault(); dragging = true; } }}
      ondragleave={() => (dragging = false)}
      ondrop={dropFiles}>
      {#key m ? "" : library.currentId}
        <Editor bind:value={source} diagnostics={compiled.diagnostics} {costs} lang={i18n.lang} costTitle="" />
      {/key}
    </div>
    <div class={["flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem]", errorCount > 0 ? "text-bad" : "text-muted"]}>
      {#if notice}
        <span class="size-[7px] flex-none rounded-full bg-accent"></span><span class="text-ink">{notice}</span>
      {:else if firstError}
        <span class="size-[7px] flex-none rounded-full bg-bad shadow-[0_0_6px_var(--bad)]"></span>
        {t("errors", errorCount)} — {t("line")} {firstError.line}: {message(firstError.code, firstError.args, i18n.lang)}
      {:else if compiled.program}
        <span class="size-[7px] flex-none rounded-full bg-ok shadow-[0_0_6px_var(--ok)]"></span>
        {@render usage(t("codeUsage"), compiled.program.size, rules.maxCodeSize)}
        {@render usage(t("memUsage"), compiled.program.globals, rules.memorySize - MIN_STACK)}
        {#if fits}<span class="font-mono text-xs">{t("fitsClass", message("CLASS_" + fits, [], i18n.lang))}</span>{/if}
        {#if warningCount}<span class="font-mono text-xs text-hot">{t("warnings", warningCount)}</span>{/if}
      {/if}
    </div>
  </section>

  <!-- arena -->
  <section class="flex min-h-0 min-w-0 flex-col gap-2">
    <div class="flex min-h-8 flex-wrap items-center gap-2">
      {#if m}
        <span class="flex flex-1 items-center gap-2.5 font-tech text-base font-semibold tracking-wide">
          <span class="rounded-xs border border-accent px-1.5 text-[0.68rem] uppercase tracking-[0.14em] text-accent">{t("missionN", index + 1)}</span>
          {m.title[i18n.lang]}
        </span>
      {:else}
        {#each slots as _, i (i)}
          <span class="flex min-w-0 flex-[1_1_6rem] items-center gap-1.5" style:--c={COLORS[i]}>
            <span class="diamond size-[7px]"></span>
            <select class={["min-w-0 flex-1 px-1.5", slots[i] && !slotOk[i] && "border-bad text-bad"]} bind:value={slots[i]}
              aria-label={t("participantN", i + 1)} title={slots[i] && !slotOk[i] ? t("slotInvalid") : ""}>
              <option value="">{t("none")}</option>
              <option value={EDITOR}>✎ {library.current.name}</option>
              <optgroup label={t("myRobots")}>
                {#each library.robots as r (r.id)}<option value={userRef(r.id)}>{r.name}</option>{/each}
              </optgroup>
              <optgroup label={t("examples")}>
                {#each samples() as s (s.id)}<option value={sampleRef(s.id)}>{s.title}</option>{/each}
              </optgroup>
            </select>
          </span>
        {/each}
      {/if}
      <button class="btn-primary" onclick={fight} disabled={m ? !compiled.ok : readyCount < 2}
        title={m ? (compiled.ok ? "" : t("fixErrors")) : readyCount < 2 ? t("needTwo") : ""}>{t("fight")}</button>
    </div>

    <div class="min-w-0 xl:min-h-0 xl:flex-1" bind:clientWidth={slotW} bind:clientHeight={slotH}>
      <Arena {frame} {names} colors={matchColors} size={arenaSize} {marks} zones={m?.zones} {hits} {stains} outLabel={t("outLabel")} label={t("arena")} themeKey={theme.resolved} />
    </div>

    <div class="flex min-h-8 flex-wrap items-center gap-2">
      <button class="grid size-8 place-items-center p-0" onclick={togglePlay} disabled={!replay}
        title={playing ? t("pause") : t("playBtn")} aria-label={playing ? t("pause") : t("playBtn")}>
        <svg viewBox="0 0 16 16" aria-hidden="true" class="size-3.5">
          {#if playing}<path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />{:else}<path d="M4 2.5v11l9-5.5z" fill="currentColor" />{/if}
        </svg>
      </button>
      <button class="grid size-8 place-items-center p-0" onclick={() => { tick = 0; }} disabled={!replay} title={t("restart")} aria-label={t("restart")}>
        <svg viewBox="0 0 16 16" aria-hidden="true" class="size-3.5"><path d="M3 3h2v10H3zM13 3v10L6 8z" fill="currentColor" /></svg>
      </button>
      <input class="min-w-20 flex-[1_1_6rem] accent-accent" type="range" min="0" max={lastTick} bind:value={tick} disabled={!replay} aria-label={t("tick")} />
      <span class="font-mono text-xs text-muted">T {String(tick).padStart(5, "0")} / {String(lastTick).padStart(5, "0")}</span>
      <select bind:value={speed} onchange={() => save("speed", String(speed))} aria-label={t("speed")} title={t("speed")}>
        {#each SPEEDS as s (s)}<option value={s}>{s}×</option>{/each}
      </select>
      {#if !m}
        <label class="flex items-center gap-1.5" title={t("classHint")}><span class="label-tech">{t("robotClass")}</span>
          <select bind:value={klass} onchange={() => save("class", klass)}>
            {#each ROBOT_CLASSES as c (c.id)}
              <option value={c.id}>{message("CLASS_" + c.id, [], i18n.lang)}</option>
            {/each}
          </select>
        </label>
        <label class="flex items-center gap-1.5"><span class="label-tech">{t("seed")}</span>
          <input class="w-22 font-mono text-sm" type="number" bind:value={seed} /></label>
        <button class="grid size-8 place-items-center p-0" onclick={() => (seed = Math.floor(Math.random() * 1_000_000))} title={t("newSeed")} aria-label={t("newSeed")}>
          <svg viewBox="0 0 16 16" aria-hidden="true" class="size-3.5"><path d="M13.3 6.2A5.5 5.5 0 1 0 13.5 10" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M14 2.5v4.2H9.8z" fill="currentColor" /></svg>
        </button>
      {/if}
    </div>
  </section>

  <!-- side column -->
  <aside class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden md:col-span-2 xl:col-span-1">
    {#if m}
      <div class="panel min-h-24 flex-[0_1_auto] overflow-y-auto px-3.5 pt-2.5 pb-3 text-[0.88rem] [&_code]:rounded-xs [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:text-[0.88em] [&_p]:my-1.5 [&_p]:leading-normal">
        <div class="flex items-center justify-between">
          <button class="btn-link text-xs" onclick={() => onopen(null)}>{t("allMissions")}</button>
          {#if progress.has(m.id)}
            <span class="rounded-xs border border-ok px-1.5 font-tech text-[0.7rem] uppercase tracking-[0.12em] text-ok">{t("done")}</span>
          {/if}
        </div>
        <h3 class="mt-1.5 mb-1 text-lg">{m.title[i18n.lang]}</h3>
        <RichText text={m.intro[i18n.lang]} />
        <div class="my-2.5 rounded-xs border border-accent/45 bg-accent-soft px-2.5 py-2">
          <span class="panel-title mr-1 inline-flex text-accent">{t("goal")}</span> {m.goal[i18n.lang]}
        </div>
        {#each m.hints.slice(0, hintsShown) as h, i (i)}
          <div class="my-1.5 rounded-xs border border-dashed border-line-strong px-2.5 py-1.5 [&_p]:inline">
            <span class="panel-title mr-1 inline-flex text-hot" style:--mk="var(--hot)">{t("hintN", i + 1)}</span> <RichText text={h[i18n.lang]} />
          </div>
        {/each}
        {#if hintsShown < m.hints.length}
          <button class="px-2.5 py-0.5 text-xs" onclick={() => hintsShown++}>+ {t("showHint")}</button>
        {/if}
      </div>
    {/if}

    {#if missionText}
      <div class={["panel flex flex-none flex-col items-center gap-2 p-2.5 text-center font-tech font-bold tracking-wide",
        missionOk ? "border-ok/55 bg-ok/10 text-lg text-ok" : "border-bad/45 bg-bad/8 text-[0.92rem] text-bad"]}>
        <span>{missionText}</span>
        {#if missionOk && next}<button class="btn-primary" onclick={() => onopen(next.id)}>{t("nextMission")}</button>{/if}
      </div>
    {:else if resultText}
      <div class="panel flex-none p-2.5 text-center font-tech text-lg font-bold tracking-wide">{resultText}</div>
    {/if}

    {#if frame}
      <div class="grid flex-none grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
        {#each frame.robots as r, i (i)}
          <div class={["panel px-2.5 pt-1.5 pb-2", r.out && "opacity-60"]} style:--c={matchColors[i]}>
            <div class="flex items-center gap-2 font-tech text-[0.9rem] font-semibold tracking-wide">
              <span class="diamond shadow-[0_0_6px_var(--c)]"></span>{names[i]}
              <span class="ml-auto font-mono text-xs">{r.paint}%</span>
            </div>
            <!-- paint on the robot, split by who threw it -->
            <div class="mt-1.5 mb-1 flex h-1.5 overflow-hidden bg-surface-3" title={t("paintOf", r.paint)}>
              {#each r.paintBy as amount, k (k)}
                {#if amount > 0}<div class="h-full" style:width="{amount}%" style:background={matchColors[k] ?? WALL_PAINT}></div>{/if}
              {/each}
            </div>
            <div class="flex flex-wrap gap-x-3 font-mono text-[0.68rem] text-muted">
              {#if r.out}<span class="font-semibold text-(--c)">{t("outOfGame")}</span>
              {:else}<span>{t("speedLabel")} {r.speed}%</span><span>{cyclesLastTick[i]} {t("cyclesTick")}</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    {:else if !m}
      <p class="m-0 text-xs text-dim">{t("noMatch")}</p>
    {/if}

    {#if profile}
      <details class="panel flex-none px-3 py-2 text-[0.85rem]" open>
        <summary class="cursor-pointer list-none"><span class="panel-title" style:--mk="var(--hot)">{t("profile")}</span></summary>
        <p class="mt-1 mb-0 text-xs text-dim">{t("profileHint")}</p>
        <ol class="mt-1.5 grid list-none gap-0.5 p-0">
          {#each profile.top as p (p.line)}
            <li class="flex min-w-0 items-baseline gap-2">
              <span class="min-w-12 bg-linear-to-r from-hot/40 from-(--w) to-transparent to-(--w) px-1 text-right font-mono text-xs font-bold"
                style:--w="{Math.round(p.share * 100)}%">{Math.round(p.share * 100)}%</span>
              <span class="whitespace-nowrap font-mono text-[0.72rem] text-dim">{t("line")} {p.line}</span>
              <code class="truncate text-[0.78rem]">{p.code}</code>
            </li>
          {/each}
        </ol>
      </details>
    {/if}

    <div class="panel flex min-h-28 flex-col xl:flex-1">
      <h3 class="panel-title border-b border-line px-3 py-2">{t("console")}</h3>
      <div class="max-h-56 overflow-y-auto px-3 py-1.5 font-mono text-[0.74rem] leading-normal xl:max-h-none xl:min-h-0 xl:flex-1" {@attach scrollToEnd}>
        {#each visibleLog as e (e.id)}
          <div class={[e.kind === "error" && "text-bad", e.kind === "info" && "text-muted"]}>
            <span class="text-dim">{String(e.tick).padStart(5, "0")}</span> <b style:color={matchColors[e.robot]}>{names[e.robot]}</b> {e.text}
          </div>
        {:else}
          <div class="text-xs text-dim">{t("consoleEmpty")}</div>
        {/each}
      </div>
    </div>
  </aside>
</div>
