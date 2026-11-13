<script lang="ts">
  // A point that can be dragged with the mouse or a finger, or moved with the
  // arrow keys (10 m, 1 m with Shift). Coordinates are whole metres.
  import type { Mapper } from "./Plane.svelte";
  import { clamp } from "./geom.ts";

  interface Props {
    v: Mapper;
    x: number;
    y: number;
    min?: number;
    max?: number;
    label: string;
    color?: string;
    r?: number;
    /** Where to draw it, if different from (x, y) (e.g. kept on a circle). */
    at?: [number, number];
  }
  let { v, x = $bindable(), y = $bindable(), min = 0, max = 1000, label, color = "var(--accent)", r = 11, at }: Props = $props();
  const dx = $derived(v.sx(at ? at[0] : x)), dy = $derived(v.sy(at ? at[1] : y));
  let dragging = $state(false);

  function move(e: PointerEvent) {
    const p = v.world(e);
    x = Math.round(clamp(p.x, min, max));
    y = Math.round(clamp(p.y, min, max));
  }

  function keys(e: KeyboardEvent) {
    const step = e.shiftKey ? 1 : 10;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    x = clamp(x + m[0], min, max);
    y = clamp(y + m[1], min, max);
  }
</script>

<g class="dg-handle" role="slider" tabindex="0" aria-label={label} aria-valuetext="({x}, {y})" aria-valuenow={x}
  style:cursor={dragging ? "grabbing" : "grab"}
  onpointerdown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); dragging = true; move(e); }}
  onpointermove={(e) => { if (dragging) move(e); }}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
  onkeydown={keys}>
  <circle cx={dx} cy={dy} r={r + 9} fill="transparent" />
  <circle class="dg-handle-ring" cx={dx} cy={dy} r={r + 4} style:stroke={color} />
  <circle cx={dx} cy={dy} r={r} style:fill={color} class="dg-handle-dot" />
</g>
