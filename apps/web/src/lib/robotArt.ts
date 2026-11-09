// Drawing of robots, paint splats and balloons on the arena canvas.
//
// A robot is a disc seen from above: a white body that gets covered in
// splats, a thick ring and a nozzle (pointing where it is heading) in its own
// colour, which never get dirty. Each splat on the body has the colour of
// the robot that threw it and an area proportional to the paint it left, so
// the body is fully covered at 100%. Shapes are SVG paths in local units
// (body radius 40), turned into Path2D objects and cached.

/** Paint received by a robot: `by` is the robot it comes from (or WALL), `a` the amount. */
export interface Hit { by: number; a: number }

/** Ticks a paint stain on the floor takes to fade away. */
export const STAIN_TICKS = 500;

/** Colour of the paint that comes from no robot (fresh paint on the walls). */
export const WALL_PAINT = "#9aa6b1";

const BODY = 40;
const RING = 45.5, RING_WIDTH = 11;
/** Outer radius of the robot, nozzle excluded, in local units. */
export const ROBOT_RADIUS = RING + RING_WIDTH / 2;
const BASE = "#f7f3ea";

/** Small deterministic random generator (graphics only). */
export function rng32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes a #rrggbb colour with black (f > 0) to darken it. */
export function darken(hex: string, f = 0.35): string {
  const v = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)));
  return "#" + v.map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** SVG path of a paint splat: a blob with a few lobes and some droplets around it. */
export function splatPath(rnd: () => number, cx: number, cy: number, r: number): string {
  const n = 9 + Math.floor(rnd() * 6), pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.45;
    let rr = r * (0.72 + rnd() * 0.4);
    if (rnd() < 0.28) rr = r * (1.22 + rnd() * 0.4);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const f = (v: number) => v.toFixed(1);
  const m = mid(pts[n - 1], pts[0]);
  let d = `M${f(m[0])} ${f(m[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = mid(p, pts[(i + 1) % n]);
    d += `Q${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`;
  }
  d += "Z";
  const drops = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < drops; k++) {
    const a = rnd() * Math.PI * 2, dist = r * (1.3 + rnd() * 0.55), rr = r * (0.08 + rnd() * 0.11);
    const x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist;
    d += `M${f(x - rr)} ${f(y)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0Z`;
  }
  return d;
}

const cache = new Map<string, Path2D>();
function cached(key: string, make: () => string): Path2D {
  let p = cache.get(key);
  if (!p) {
    if (cache.size > 4000) cache.clear();
    p = new Path2D(make());
    cache.set(key, p);
  }
  return p;
}

/** Splat number `i` on the body of a robot: position and shape depend only on (seed, i). */
function bodySplat(seed: number, i: number, a: number): Path2D {
  return cached(`b${seed}:${i}:${a}`, () => {
    const rnd = rng32(seed * 7919 + i * 104729 + 17);
    const ang = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * 0.85 * BODY;
    const r = BODY * Math.sqrt((a / 100) * 1.25);
    return splatPath(rnd, Math.cos(ang) * dist, Math.sin(ang) * dist, r);
  });
}

/** A stain on the floor, radius 1 (scaled when drawn). */
export function stainPath(seed: number): Path2D {
  return cached(`s${seed}`, () => splatPath(rng32(seed), 0, 0, 1));
}

export interface RobotLook {
  /** Colour of each robot of the match; paint from WALL uses WALL_PAINT. */
  colors: string[];
  /** Index of this robot (its colour and the seed of its splats). */
  index: number;
  hits: Hit[];
  out: boolean;
}

/**
 * Draws a robot centred in (x, y) pixels, `scale` pixels per local unit,
 * heading in degrees (0 = east, counterclockwise).
 */
export function drawRobot(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, heading: number, look: RobotLook) {
  const own = look.colors[look.index];
  const paintColor = (by: number) => (by === look.index ? darken(own, 0.3) : look.colors[by] ?? WALL_PAINT);
  ctx.save();
  if (look.out) {
    ctx.globalAlpha = 0.5;
    ctx.filter = "saturate(0.3)";
  }
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate((-heading * Math.PI) / 180);

  // nozzle, under the ring
  ctx.fillStyle = own;
  ctx.strokeStyle = darken(own);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(36, -9, 27, 18, 5);
  ctx.fill();
  ctx.stroke();

  // body and paint, clipped to the body
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, BODY, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = BASE;
  ctx.fill();
  const total = look.hits.reduce((s, h) => s + h.a, 0);
  if (total >= 100) {
    // fully painted: a coat in the colour that contributed most, under the splats
    const by = new Map<number, number>();
    for (const h of look.hits) by.set(h.by, (by.get(h.by) ?? 0) + h.a);
    const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0][0];
    ctx.fillStyle = paintColor(top);
    ctx.fillRect(-BODY, -BODY, 2 * BODY, 2 * BODY);
  }
  look.hits.forEach((h, i) => {
    ctx.fillStyle = paintColor(h.by);
    ctx.fill(bodySplat(look.index + 1, i, h.a));
  });
  ctx.restore();

  // ring in the robot's colour, always clean
  ctx.strokeStyle = own;
  ctx.lineWidth = RING_WIDTH;
  ctx.beginPath();
  ctx.arc(0, 0, RING, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = darken(own, 0.2);
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, BODY, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A balloon in flight; `f` (0–1) is how far along the throw it is: it grows halfway, as if lobbed. */
export function drawBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, f: number, color: string) {
  const k = radius * (1 + 0.5 * Math.sin(Math.PI * f));
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = darken(color);
  ctx.lineWidth = Math.max(1, k * 0.2);
  ctx.beginPath();
  ctx.ellipse(0, 0, k, k * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = darken(color);
  ctx.beginPath();
  ctx.moveTo(-k * 0.3, k * 1.15);
  ctx.lineTo(k * 0.3, k * 1.15);
  ctx.lineTo(0, k * 1.55);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-k * 0.35, -k * 0.42, k * 0.28, k * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
