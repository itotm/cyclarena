<script lang="ts">
  // Bar for the user's robots: choose the robot to edit, new, rename,
  // duplicate, delete, import and export.
  import { i18n } from "./i18n.svelte.ts";
  import { library, MAX_NAME } from "./library.svelte.ts";
  import { samples } from "./samples.ts";

  interface Props {
    /** The open robot has changed: the editor must reload the code. */
    onchange: () => void;
    /** Short message to show below the editor. */
    onnotice: (text: string) => void;
  }
  let { onchange, onnotice }: Props = $props();
  const t = i18n.t;

  let renaming = $state(false);
  let draft = $state("");
  let confirming = $state(false);
  let fileInput: HTMLInputElement;

  function select(id: string) {
    library.select(id);
    confirming = false;
    onchange();
  }

  function create(e: Event & { currentTarget: HTMLSelectElement }) {
    const v = e.currentTarget.value;
    e.currentTarget.value = "";
    if (!v) return;
    if (v === "blank") library.create(t("newRobotName"));
    else library.createFromSample(v);
    onchange();
  }

  function startRename() {
    draft = library.current.name;
    renaming = true;
    confirming = false;
  }

  function finishRename(ok: boolean) {
    if (!renaming) return;
    renaming = false;
    if (ok) library.rename(library.currentId, draft);
  }

  function remove() {
    // second press: confirm (no dialog boxes)
    if (!confirming) { confirming = true; return; }
    const name = library.current.name;
    library.remove(library.currentId);
    confirming = false;
    onchange();
    onnotice(t("deleted", name));
  }

  async function importFiles() {
    if (!fileInput.files?.length) return;
    const { added, skipped } = await library.importFiles(fileInput.files);
    fileInput.value = "";
    onchange();
    onnotice([added.length ? t("imported", added.join(", ")) : "", skipped.length ? t("importSkipped", skipped.join(", ")) : ""].filter(Boolean).join(" · "));
  }

  function focusSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

{#snippet icon(path: string)}
  <svg viewBox="0 0 16 16" aria-hidden="true" class="size-3.5"><path d={path} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
{/snippet}

<div class="flex min-h-8 flex-wrap items-center gap-1.5">
  <span class="diamond size-[7px]" style:--c="var(--accent)"></span>
  {#if renaming}
    <input class="w-52 font-tech font-semibold" maxlength={MAX_NAME} bind:value={draft} aria-label={t("robotName")} {@attach focusSelect}
      onkeydown={(e) => { if (e.key === "Enter") finishRename(true); else if (e.key === "Escape") finishRename(false); }}
      onblur={() => finishRename(true)} />
  {:else}
    <select class="max-w-52 min-w-0 font-tech font-semibold" value={library.currentId} aria-label={t("robotToEdit")}
      onchange={(e) => select(e.currentTarget.value)}>
      {#each library.robots as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
    </select>
  {/if}

  <span class="flex">
    <button class="grid size-8 place-items-center p-0" onclick={startRename} title={t("rename")} aria-label={t("rename")}>
      {@render icon("M10.5 2.5l3 3L6 13H3v-3z")}
    </button>
    <button class="-ml-px grid size-8 place-items-center p-0" onclick={() => { library.duplicate(library.currentId); onchange(); }} title={t("duplicate")} aria-label={t("duplicate")}>
      {@render icon("M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3")}
    </button>
    <button class={["-ml-px grid h-8 place-items-center p-0", confirming ? "border-bad px-2 text-xs text-bad" : "w-8"]}
      onclick={remove} onblur={() => (confirming = false)} title={t("delete")} aria-label={confirming ? t("confirmDelete") : t("delete")}>
      {#if confirming}{t("confirmDelete")}{:else}{@render icon("M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9")}{/if}
    </button>
  </span>

  <span class="flex">
    <button class="grid size-8 place-items-center p-0" onclick={() => fileInput.click()} title={t("importHint")} aria-label={t("import")}>
      {@render icon("M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3")}
    </button>
    <button class="-ml-px grid size-8 place-items-center p-0" onclick={() => library.exportRobot(library.currentId)} title={t("exportHint")} aria-label={t("export")}>
      {@render icon("M8 2.5v8M5 7.5l3 3 3-3M2.5 10.5v3h11v-3")}
    </button>
  </span>
  <input class="hidden" type="file" accept=".pa,.txt,text/plain" multiple bind:this={fileInput} onchange={importFiles} />

  <select class="w-28 px-1.5 text-sm" onchange={create} aria-label={t("newRobot")}>
    <option value="">+ {t("newRobot")}</option>
    <option value="blank">{t("blankRobot")}</option>
    <optgroup label={t("copyOfExample")}>
      {#each samples() as s (s.id)}<option value={s.id}>{s.title}</option>{/each}
    </optgroup>
  </select>
</div>
