<script lang="ts">
  import Play from "./lib/Play.svelte";
  import Learn from "./lib/Learn.svelte";
  import Manual from "./lib/manual/Manual.svelte";
  import About from "./lib/About.svelte";
  import Tournament from "./lib/Tournament.svelte";
  import { i18n } from "./lib/i18n.svelte.ts";
  import { theme } from "./lib/theme.svelte.ts";
  import { MISSIONS, missionView } from "./lib/missions.ts";
  import { progress } from "./lib/progress.svelte.ts";

  const t = i18n.t;

  // routes: #about (the start page), #learn, #play, #m/<mission>, #tournament,
  // #manual, #manual/<section>
  type Route = { page: "learn" | "play" | "tournament" | "manual" | "about"; mission: string | null; section?: string };

  function parse(hash: string): Route {
    const h = hash.replace(/^#/, "");
    if (h.startsWith("m/") && MISSIONS.some((m) => m.id === h.slice(2))) return { page: "play", mission: h.slice(2) };
    if (h.startsWith("manual/")) return { page: "manual", mission: null, section: h.slice(7) };
    if (h === "learn" || h === "manual" || h === "about" || h === "play" || h === "tournament") return { page: h, mission: null };
    return { page: "about", mission: null };
  }

  let route = $state<Route>(parse(location.hash));
  // the mission with the texts of the chosen path (basic or advanced)
  const mission = $derived.by(() => {
    const m = route.mission ? MISSIONS.find((x) => x.id === route.mission) : null;
    return m ? missionView(m, progress.path) : null;
  });

  function go(hash: string) {
    history.pushState(null, "", "#" + hash);
    route = parse("#" + hash);
  }

  const nav = $derived([
    { id: "about", label: t("about") },
    { id: "learn", label: t("learn") },
    { id: "play", label: t("play") },
    { id: "tournament", label: t("tournament") },
    { id: "manual", label: t("manual") },
  ]);

  const themeLabel = $derived(theme.mode === "auto" ? t("themeAuto") : theme.mode === "dark" ? t("themeDark") : t("themeLight"));
</script>

<svelte:window onpopstate={() => (route = parse(location.hash))} onhashchange={() => (route = parse(location.hash))} />

<header class="relative flex h-[50px] flex-none items-stretch gap-6 border-b border-line bg-surface px-3 max-md:gap-2.5
  after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-linear-to-r after:from-accent after:to-transparent after:to-40% after:opacity-70">
  <a class="flex items-center gap-2.5 font-tech text-[1.05rem] font-bold tracking-[0.22em] text-ink no-underline" href="#about"
    onclick={(e) => { e.preventDefault(); go("about"); }}>
    <img src="./favicon.svg" alt="" width="26" height="26" />
    <span class="max-md:hidden">paintarena</span>
  </a>
  <nav class="flex items-stretch gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
    {#each nav as n (n.id)}
      <a href="#{n.id}" aria-current={route.page === n.id ? "page" : undefined}
        class="flex items-center whitespace-nowrap border-y-2 border-transparent px-3 font-tech text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-muted no-underline hover:text-ink aria-[current=page]:border-b-accent aria-[current=page]:text-accent"
        onclick={(e) => { e.preventDefault(); go(n.id); }}>{n.label}</a>
    {/each}
  </nav>
  <div class="ml-auto flex flex-none items-center gap-2.5">
    <button class="flex items-center gap-1.5 px-2.5 py-1 text-xs uppercase tracking-[0.08em]" onclick={() => theme.cycle()}
      title="{t('theme')}: {themeLabel}" aria-label="{t('theme')}: {themeLabel}">
      <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4 text-accent">
        {#if theme.mode === "auto"}
          <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
        {:else if theme.mode === "dark"}
          <path d="M13.5 3.2A7 7 0 1 0 16.8 13 5.6 5.6 0 0 1 13.5 3.2z" fill="currentColor" />
        {:else}
          <circle cx="10" cy="10" r="3.6" fill="currentColor" /><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" /></g>
        {/if}
      </svg>
      <span class="max-md:hidden">{themeLabel}</span>
    </button>
    <div class="flex" role="group" aria-label="Lingua / Language">
      {#each ["it", "en"] as const as l (l)}
        <button class={["px-2 py-1 text-xs tracking-widest not-first:-ml-px", i18n.lang === l && "relative border-accent bg-accent-soft text-accent"]}
          onclick={() => i18n.set(l)}>{l.toUpperCase()}</button>
      {/each}
    </div>
  </div>
</header>

<main class={["min-h-0 flex-1 overflow-auto p-3", (route.page === "play" || route.page === "tournament") && "xl:overflow-hidden"]}>
  {#if route.page === "learn"}
    <Learn onopen={(id) => go(id ? "m/" + id : "play")} />
  {:else if route.page === "tournament"}
    <Tournament />
  {:else if route.page === "manual"}
    <Manual lang={i18n.lang} section={route.section} />
  {:else if route.page === "about"}
    <About lang={i18n.lang} onopen={go} />
  {:else}
    {#key route.mission + progress.path}
      <Play {mission} onopen={(id) => go(id ? "m/" + id : "learn")} />
    {/key}
  {/if}
</main>
