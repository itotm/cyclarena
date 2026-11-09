<script lang="ts">
  // Plain text with `code` in backticks and paragraphs separated by a blank line.
  let { text }: { text: string } = $props();
  const paragraphs = $derived(text.split(/\n\s*\n/).map((p) => p.split("`")));
</script>

{#each paragraphs as parts, i (i)}
  <p>{#each parts as part, j (j)}{#if j % 2}<code>{part}</code>{:else}{part}{/if}{/each}</p>
{/each}
