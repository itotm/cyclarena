<script lang="ts">
  // Picks the diagram of a function card.
  import type { Lang } from "@paintarena/engine";
  import type { DiagramId } from "./fnCards.ts";
  import ArenaCoords from "./diagrams/ArenaCoords.svelte";
  import DriveChart from "./diagrams/DriveChart.svelte";
  import ScanCone from "./diagrams/ScanCone.svelte";
  import ThrowArc from "./diagrams/ThrowArc.svelte";
  import DirDist from "./diagrams/DirDist.svelte";
  import PointXY from "./diagrams/PointXY.svelte";
  import TrigCircle from "./diagrams/TrigCircle.svelte";

  let { id, lang }: { id: DiagramId; lang: Lang } = $props();
</script>

{#if id === "drive"}<DriveChart {lang} />
{:else if id === "drive_to"}<DirDist {lang} mode="drive" />
{:else if id === "loc"}<ArenaCoords {lang} />
{:else if id === "scan"}<ScanCone {lang} />
{:else if id === "throw"}<ThrowArc {lang} />
{:else if id === "throw_at"}<DirDist {lang} mode="throw_at" />
{:else if id === "dirdist"}<DirDist {lang} />
{:else if id === "point"}<PointXY {lang} />
{:else if id === "atan2"}<DirDist {lang} mode="atan2" />
{:else if id === "trig_point"}<PointXY {lang} trig />
{:else if id === "sincos"}<TrigCircle {lang} />
{/if}
