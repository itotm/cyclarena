<script lang="ts">
  // A robot seen from above: a coloured disc with a notch towards its heading.
  import type { Mapper } from "./Plane.svelte";
  import { polar } from "./geom.ts";

  interface Props { v: Mapper; x: number; y: number; color: string; heading?: number | null; r?: number; label?: string; dim?: boolean }
  let { v, x, y, color, heading = null, r = 10, label = "", dim = false }: Props = $props();
  const cx = $derived(v.sx(x)), cy = $derived(v.sy(y));
</script>

<g opacity={dim ? 0.45 : 1}>
  <circle {cx} {cy} r={r} style:fill={color} class="dg-robot" />
  {#if heading !== null}
    {@const [hx, hy] = polar(cx, cy, r + 6, heading)}
    <line x1={cx} y1={cy} x2={hx} y2={hy} class="dg-robot-nose" />
  {/if}
  {#if label}<text x={cx} y={cy - r - 6} text-anchor="middle" class="dg-label">{label}</text>{/if}
</g>
