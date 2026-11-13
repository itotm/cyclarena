// Small geometry helpers for the manual's diagrams. Angles are in degrees,
// counterclockwise from east, as in the game; the SVG y axis points down.

/** Point at distance r from (cx, cy) in direction deg, in SVG coordinates. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

/** SVG path of an arc of radius r from direction `from` to `to`, counterclockwise. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  let sweep = (((to - from) % 360) + 360) % 360;
  if (sweep === 0) return "";
  if (sweep >= 359.99) sweep = 359.99;
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, from + sweep);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${x1} ${y1}`;
}

/** SVG path of a circular sector (the radar cone) from `from` to `to`, counterclockwise. */
export function sectorPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  const sweep = (((to - from) % 360) + 360) % 360;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${x1} ${y1} Z`;
}

let counter = 0;
/** Unique id for SVG markers (several diagrams live on the same page). */
export function uid(prefix: string): string {
  return `${prefix}-${++counter}`;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Colours of the robots, as in the arena. */
export const ROBOT_COLORS = ["#ff7a1a", "#2f9bff", "#1fcf8c", "#b46bff"];
