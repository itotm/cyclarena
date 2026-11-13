<script lang="ts" module>
  /** Conversion between metres of the arena and SVG units. */
  export interface Mapper {
    sx: (x: number) => number;
    sy: (y: number) => number;
    /** SVG units per metre. */
    k: number;
    width: number;
    height: number;
    /** Point of the plane under the pointer, in metres. */
    world: (e: PointerEvent) => { x: number; y: number };
  }
</script>

<script lang="ts">
  // A piece of the plane drawn in SVG: x0, y0, w, h in metres (y upwards, as
  // in the arena). The content receives the mapper to place things.
  import type { Snippet } from "svelte";

  interface Props {
    x0?: number;
    y0?: number;
    w: number;
    h: number;
    /** Width in SVG units (the drawing then scales with the page). */
    width?: number;
    label: string;
    children: Snippet<[Mapper]>;
  }
  let { x0 = 0, y0 = 0, w, h, width = 480, label, children }: Props = $props();

  let svg = $state<SVGSVGElement>();
  const k = $derived(width / w);
  const height = $derived(h * k);
  const v = $derived<Mapper>({
    sx: (x) => (x - x0) * k,
    sy: (y) => (y0 + h - y) * k,
    k, width, height,
    world: (e) => {
      const m = svg?.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: x0 + p.x / k, y: y0 + h - p.y / k };
    },
  });
</script>

<svg bind:this={svg} class="dg block h-auto w-full touch-none select-none" viewBox="0 0 {width} {height}" role="group" aria-label={label}>
  {@render children(v)}
</svg>
