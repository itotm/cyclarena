<script lang="ts">
  import { i18n, type TextKey } from "./i18n.svelte.ts";
  import { GROUPS, MISSIONS, type MissionGroup } from "./missions.ts";
  import { progress } from "./progress.svelte.ts";

  let { onopen }: { onopen: (id: string | null) => void } = $props();
  const t = i18n.t;
  const count = $derived(MISSIONS.filter((m) => progress.has(m.id)).length);
  const GROUP_LABEL: Record<MissionGroup, TextKey> = { move: "groupMove", see: "groupSee", throw: "groupThrow", play: "groupPlay" };
</script>

<article class="mx-auto max-w-[56rem] pt-4">
  <h1 class="mt-0 mb-2 text-[2rem] tracking-[0.06em]">{t("learnTitle")}</h1>
  <p class="max-w-[44rem] text-[1.05rem] leading-relaxed text-muted">{t("learnIntro")}</p>
  <p class="my-4 font-mono text-[0.8rem] tracking-wide text-accent">{t("progress", count, MISSIONS.length)}</p>
  {#each GROUPS as g (g)}
    <h2 class="panel-title mt-6 mb-2 text-[0.8rem] text-ink">{t(GROUP_LABEL[g])}</h2>
    <ol class="grid grid-cols-[repeat(auto-fill,minmax(min(24rem,100%),1fr))] gap-2">
      {#each MISSIONS as m, i (m.id)}
        {#if m.group === g}
          {@const done = progress.has(m.id)}
          <li>
            <button class="flex h-full w-full items-start gap-3.5 rounded-panel bg-surface px-4 py-3.5 text-left font-ui font-normal tracking-normal hover:not-disabled:border-accent hover:not-disabled:bg-surface"
              onclick={() => onopen(m.id)}>
              <span class={["chamfer grid size-9 flex-none place-items-center border font-mono text-[0.85rem] font-bold",
                done ? "border-ok bg-ok text-surface" : "border-line-strong text-accent"]}>{done ? "✓" : String(i + 1).padStart(2, "0")}</span>
              <span class="flex flex-col gap-1">
                <span class="font-tech text-[1.05rem] font-semibold tracking-wide">{m.title[i18n.lang]}</span>
                <span class="text-[0.88rem] text-muted">{m.goal[i18n.lang]}</span>
              </span>
            </button>
          </li>
        {/if}
      {/each}
    </ol>
  {/each}
  <p class="my-4"><button class="btn-link text-[0.85rem]" onclick={() => onopen(null)}>{t("freePlay")} →</button></p>
</article>
