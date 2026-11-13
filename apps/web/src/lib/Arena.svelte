<script lang="ts">
  import type { Frame } from "@paintarena/engine";
  import { drawBalloon, drawRobot, ROBOT_RADIUS, STAIN_TICKS, stainPath, type Hit } from "./robotArt.ts";

  interface Props {
    frame: Frame | null;
    names: string[];
    colors: string[];
    /** Side of the field in CSS pixels. */
    size: number;
    /** Debug marks made with mark(), already filtered for the current tick. */
    marks: { robot: number; x: number; y: number }[];
    /** Zones to reach (missions). */
    zones?: { x: number; y: number; r: number }[];
    /** Paint received so far by each robot, in order (for the splats on its body). */
    hits: Hit[][];
    /** Paint stains on the floor, with their age in ticks (graphics only). */
    stains: { owner: number; x: number; y: number; age: number; seed: number }[];
    /** Text of the label above robots out of the game. */
    outLabel: string;
    label: string;
    /** Changes with the theme: only used to redraw with the new colors. */
    themeKey?: string;
  }

  let { frame, names, colors, size, marks, zones = [], hits, stains, outLabel, label, themeKey = "" }: Props = $props();

  const ARENA = 1000, RANGE = 700;
  /** Size of the robots: local units → metres of the arena. */
  const ROBOT_SCALE = 0.42;
  let canvas: HTMLCanvasElement;

  function css(name: string) {
    return getComputedStyle(canvas).getPropertyValue(name).trim();
  }

  function draw() {
    const ctx = canvas?.getContext("2d");
    if (!ctx || size < 10) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    if (canvas.width !== px) canvas.width = canvas.height = px;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = size / ARENA;
    const X = (x: number) => x * k;
    const Y = (y: number) => size - y * k;
    const rad = (deg: number) => (-deg * Math.PI) / 180;

    ctx.fillStyle = css("--arena-bg");
    ctx.fillRect(0, 0, size, size);
    // grid: thin every 50 m, stronger every 100 m, central axes
    const line = (x0: number, y0: number, x1: number, y1: number) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
    const half = (v: number) => Math.round(v) + 0.5;
    ctx.lineWidth = 1;
    for (const [step, color] of [[50, css("--arena-grid")], [100, css("--arena-grid-major")]] as const) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let g = step; g < ARENA; g += step) {
        if (step === 50 && g % 100 === 0) continue;
        line(half(X(g)), 0, half(X(g)), size);
        line(0, half(Y(g)), size, half(Y(g)));
      }
      ctx.stroke();
    }
    // ticks and coordinates on the edges, bracket corners
    const label = css("--arena-label"), accent = css("--accent");
    ctx.fillStyle = label;
    ctx.font = `500 ${Math.max(9, size / 85)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    for (const g of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      ctx.fillText(String(g), X(g) + 3, size - 4);
      ctx.fillText(String(g), 3, Y(g) - 3);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const b = Math.max(12, size / 30), o = 1;
    ctx.beginPath();
    line(o, b, o, o); line(o, o, b, o);
    line(size - b, o, size - o, o); line(size - o, o, size - o, b);
    line(o, size - b, o, size - o); line(o, size - o, b, size - o);
    line(size - b, size - o, size - o, size - o); line(size - o, size - o, size - o, size - b);
    ctx.stroke();

    // mission flags
    for (const z of zones) {
      ctx.strokeStyle = css("--accent");
      ctx.fillStyle = css("--accent") + "22";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(X(z.x), Y(z.y), Math.max(8, z.r * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(X(z.x), Y(z.y));
      ctx.lineTo(X(z.x), Y(z.y) - 26);
      ctx.lineTo(X(z.x) + 16, Y(z.y) - 20);
      ctx.lineTo(X(z.x), Y(z.y) - 14);
      ctx.fillStyle = css("--accent");
      ctx.fill();
      ctx.stroke();
    }
    if (!frame) return;

    // paint stains on the floor, fading away
    for (const st of stains) {
      const op = 0.35 * (1 - st.age / STAIN_TICKS);
      if (op <= 0) continue;
      ctx.save();
      ctx.globalAlpha = op;
      ctx.fillStyle = colors[st.owner];
      ctx.translate(X(st.x), Y(st.y));
      ctx.scale(16 * k, 16 * k);
      ctx.fill(stainPath(st.seed));
      ctx.restore();
    }

    // radar cones
    frame.robots.forEach((r, i) => {
      if (r.out || !r.scan) return;
      ctx.fillStyle = colors[i] + "22";
      ctx.strokeStyle = colors[i] + "55";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(r.x), Y(r.y));
      const res = Math.max(r.scan.res, 0.4);
      ctx.arc(X(r.x), Y(r.y), RANGE * k, rad(r.scan.dir + res), rad(r.scan.dir - res));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // splashes: a ring of paint that opens up
    for (const e of frame.splashes) {
      const t = e.age / 6;
      ctx.strokeStyle = colors[e.owner];
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = Math.max(1, (6 - e.age) * k * 1.5);
      ctx.beginPath();
      ctx.arc(X(e.x), Y(e.y), Math.max(3, (10 + e.age * 6) * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // debug marks
    ctx.lineWidth = 2;
    for (const m of marks) {
      ctx.strokeStyle = colors[m.robot];
      const x = X(m.x), y = Y(m.y);
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5);
      ctx.stroke();
    }

    // robots: those out of the game first, underneath
    const s = Math.max(ROBOT_SCALE * k, 9 / ROBOT_RADIUS);
    const R = ROBOT_RADIUS * s;
    const nameFont = `600 ${Math.max(11, size / 62)}px "Chakra Petch", system-ui, sans-serif`;
    const muted = css("--text-muted"), text = css("--text");
    const order = frame.robots.map((_, i) => i).sort((a, b) => Number(frame.robots[b].out) - Number(frame.robots[a].out));
    for (const i of order) {
      const r = frame.robots[i];
      const x = X(r.x), y = Y(r.y);
      drawRobot(ctx, x, y, s, r.heading, { colors, index: i, hits: hits[i] ?? [], out: r.out });
      ctx.font = nameFont;
      ctx.textAlign = "center";
      // the name stays inside the arena even when the robot is near an edge
      const name = names[i] ?? "", tw = ctx.measureText(name).width / 2 + 2;
      const cx = (w: number) => Math.min(Math.max(x, w), size - w);
      if (r.out) {
        // out of the game: a label in its colour above, the name below
        ctx.font = `700 ${Math.max(10, size / 72)}px "Chakra Petch", system-ui, sans-serif`;
        const lw = ctx.measureText(outLabel).width / 2 + 7, lh = Math.max(14, size / 50);
        const ly = y - R - 6 - lh < 2 ? y + R + 6 : y - R - 6 - lh;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.roundRect(cx(lw) - lw, ly, 2 * lw, lh, lh / 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(outLabel, cx(lw), ly + lh / 2 + 0.5);
        ctx.textBaseline = "alphabetic";
        ctx.font = nameFont;
        ctx.fillStyle = muted;
        ctx.fillText(name, cx(tw), ly > y ? ly + lh + 14 : y + R + 16);
      } else {
        ctx.fillStyle = text;
        const ny = y - R - 8 < 14 ? y + R + 18 : y - R - 8;
        ctx.fillText(name, cx(tw), ny);
      }
    }

    // balloons in flight, above everything
    for (const b of frame.balloons) drawBalloon(ctx, X(b.x), Y(b.y), Math.max(2, 4 * k), b.f, colors[b.owner]);
  }

  // also redraw when the pixel density changes (window moved to another
  // screen, zoom) and when the fonts of the names have loaded
  let dprKey = $state(0);
  $effect(() => {
    let mq: MediaQueryList | null = null;
    const bump = () => { dprKey++; listen(); };
    const listen = () => {
      mq?.removeEventListener("change", bump);
      mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener("change", bump, { once: true });
    };
    listen();
    document.fonts?.ready.then(() => dprKey++);
    return () => mq?.removeEventListener("change", bump);
  });

  $effect(() => {
    // redraw when anything shown changes
    void frame; void size; void marks; void colors; void names; void zones; void hits; void stains; void outLabel; void themeKey; void dprKey;
    draw();
  });
</script>

<div class="flex-none border border-line bg-(--arena-bg)" role="img" aria-label={label} style:width="{size}px" style:height="{size}px">
  <canvas class="block" bind:this={canvas} style:width="{size}px" style:height="{size}px"></canvas>
</div>
