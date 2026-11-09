// The match: arena, robots, paint balloons. Each tick has two phases:
//  1. each robot runs its program for the tick's cycles; the sensors
//     see the world as it was at the start of the tick, so the order does not matter;
//  2. physics moves robots and balloons, and computes bumps, splashes and paint.

import { icos, iatan2, isin, isqrt, mixSeed, normDeg, Rng, roundDiv, SCALE } from "../math.ts";
import type { MsgArg } from "../i18n.ts";
import { resetCpu, runTick, type Cpu, type Host } from "../vm/cpu.ts";
import type { Program } from "../vm/program.ts";
import { RULES_V0, splashPaint, type Rules } from "../rules.ts";

export const MAX_ROBOTS = 4;

/** Where paint that comes from no robot (walls, a mission's starting paint) is counted in `paintBy`. */
export const WALL = MAX_ROBOTS;

export interface Entrant { name: string; program: Program }

export interface MatchOptions {
  seed: number;
  rules?: Rules;
  /** Records events and messages (needed by the graphics, not by tournaments). */
  record?: boolean;
  /** Counts the cycles spent by each instruction. */
  profile?: boolean;
  /** Starting positions in metres (for missions); where one is missing, it is chosen at random. */
  positions?: ({ x: number; y: number } | null)[];
  /** Starting paint of each robot, 0–99 (for missions). */
  paint?: number[];
}

export class Robot implements Cpu {
  // CPU
  mem: Int32Array;
  pc = 0; sp = 0; fp = 0; balance = 0; halted = false; cycles = 0; errors = 0;
  profile: Float64Array | null;
  rng: Rng;
  /** Radar error: a stream of its own, so rand() does not depend on it. */
  noise: Rng;
  // body (positions in mm)
  x = 0; y = 0;
  heading = 0; dHeading = 0;
  speed = 0; dSpeed = 0;
  /** Paint on the robot, 0–100: at 100 it is out of the game. */
  paint = 0;
  /** Paint by origin: one entry per robot, then WALL. */
  paintBy: number[] = new Array(MAX_ROBOTS + 1).fill(0);
  out = false;
  reload = 0;
  inFlight = 0;
  scanDir = 0; scanRes = 0; scanTick = -1000;
  /** Tick the robot went out, or -1. */
  outAt = -1;

  readonly index: number;
  readonly name: string;
  readonly program: Program;

  constructor(index: number, name: string, program: Program, rules: Rules, seed: number, profile: boolean) {
    this.index = index; this.name = name; this.program = program;
    this.mem = new Int32Array(rules.memorySize);
    this.profile = profile ? new Float64Array(program.size) : null;
    this.rng = new Rng(mixSeed(seed, index + 1), index + 1);
    this.noise = new Rng(mixSeed(seed, index + 101), index + 101);
    resetCpu(this);
  }
}

export interface Balloon {
  owner: number;
  sx: number; sy: number;
  heading: number;
  range: number;    // mm
  traveled: number; // mm
  x: number; y: number;
}

export interface Splash { owner: number; x: number; y: number; age: number }

export type MatchEvent =
  | { t: "throw"; robot: number; dir: number; dist: number }
  | { t: "splash"; robot: number; x: number; y: number }
  /** Paint received by `robot`; `by` is the robot it comes from, or WALL. */
  | { t: "paint"; robot: number; by: number; amount: number }
  | { t: "bump"; robot: number; other: number }
  | { t: "wall"; robot: number }
  | { t: "out"; robot: number }
  | { t: "print"; robot: number; text: string; line: number }
  | { t: "mark"; robot: number; x: number; y: number }
  | { t: "error"; robot: number; code: string; args: MsgArg[]; line: number }
  | { t: "halt"; robot: number };

export interface MatchResult {
  /** Index of the winner, or -1 if nobody won. */
  winner: number;
  reason: "victory" | "draw" | "timeout";
  ticks: number;
  /** Robots still in the game at the end. */
  remaining: number[];
  paint: number[];
  cycles: number[];
}

export class Match implements Host {
  readonly rules: Rules;
  readonly robots: Robot[];
  readonly balloons: Balloon[] = [];
  readonly splashes: Splash[] = [];
  readonly recording: boolean;
  readonly scanMaxRes: number;
  tick = 0;
  finished = false;
  result: MatchResult | null = null;
  /** Events of the last tick (only if record is enabled). */
  events: MatchEvent[] = [];
  private readonly arena: number;
  private readonly prevX: number[];
  private readonly prevY: number[];

  constructor(entrants: Entrant[], opts: MatchOptions) {
    if (entrants.length < 1 || entrants.length > MAX_ROBOTS) throw new Error(`1 to ${MAX_ROBOTS} robots`);
    this.rules = opts.rules ?? RULES_V0;
    this.recording = !!opts.record;
    this.scanMaxRes = this.rules.scanMaxRes;
    this.arena = this.rules.arenaSize * 1000;
    const seed = opts.seed >>> 0;
    this.robots = entrants.map((e, i) => new Robot(i, e.name, e.program, this.rules, seed, !!opts.profile));
    this.prevX = this.robots.map(() => 0);
    this.prevY = this.robots.map(() => 0);

    // starting positions: each robot in a different quadrant, chosen at random
    const rng = new Rng(seed, 0);
    const quads = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = rng.below(i + 1); [quads[i], quads[j]] = [quads[j], quads[i]]; }
    const half = this.arena / 2, margin = 50_000;
    for (const r of this.robots) {
      const q = quads[r.index];
      r.x = (q & 1) * half + margin + rng.below(half - 2 * margin);
      r.y = (q >> 1) * half + margin + rng.below(half - 2 * margin);
      const fixed = opts.positions?.[r.index];
      if (fixed) { r.x = Math.round(fixed.x * 1000); r.y = Math.round(fixed.y * 1000); }
      const p = Math.min(99, Math.max(0, Math.floor(opts.paint?.[r.index] ?? 0)));
      if (p) { r.paint = p; r.paintBy[WALL] = p; }
    }
  }

  // --- Host: what programs can read and control ---

  scan(c: Cpu, dir: number, res: number): number {
    const r = c as Robot;
    r.scanDir = dir; r.scanRes = res; r.scanTick = this.tick;
    let best = 0;
    for (const o of this.robots) {
      if (o === r || o.out) continue;
      const dx = o.x - r.x, dy = o.y - r.y;
      const diff = Math.abs(((iatan2(dy, dx) - dir) % 360 + 540) % 360 - 180);
      if (diff > res) continue;
      const d = Math.max(1, Math.floor(isqrt(dx * dx + dy * dy) / 1000));
      if (best === 0 || d < best) best = d;
    }
    // paint on the robot blurs the radar: the distance has an error that
    // grows with the paint, up to ±paintBlur% at 100%
    if (best > 0 && r.paint > 0) {
      const err = Math.floor((best * r.paint * this.rules.paintBlur) / 10000);
      if (err > 0) best = Math.max(1, best + r.noise.below(2 * err + 1) - err);
    }
    return best;
  }

  throwBalloon(c: Cpu, dir: number, dist: number): number {
    const r = c as Robot;
    if (r.reload > 0 || r.inFlight >= this.rules.balloonsPerRobot) return 0;
    dist = dist < 0 ? 0 : dist > this.rules.throwRange ? this.rules.throwRange : dist;
    this.balloons.push({ owner: r.index, sx: r.x, sy: r.y, heading: dir, range: dist * 1000, traveled: 0, x: r.x, y: r.y });
    r.reload = this.rules.reloadTicks;
    r.inFlight++;
    if (this.recording) this.events.push({ t: "throw", robot: r.index, dir, dist });
    return 1;
  }

  drive(c: Cpu, dir: number, speed: number): void {
    const r = c as Robot;
    r.dHeading = dir;
    r.dSpeed = speed;
  }

  painted(c: Cpu): number { return (c as Robot).paint; }
  speed(c: Cpu): number { return (c as Robot).speed; }
  heading(c: Cpu): number { return (c as Robot).heading; }
  locX(c: Cpu): number { return Math.floor((c as Robot).x / 1000); }
  locY(c: Cpu): number { return Math.floor((c as Robot).y / 1000); }

  print(c: Cpu, text: string, line: number): void {
    this.events.push({ t: "print", robot: (c as Robot).index, text, line });
  }
  mark(c: Cpu, x: number, y: number): void {
    this.events.push({ t: "mark", robot: (c as Robot).index, x, y });
  }
  trap(c: Cpu, code: string, args: MsgArg[], line: number): void {
    if (this.recording) this.events.push({ t: "error", robot: (c as Robot).index, code, args, line });
  }
  halt(c: Cpu): void {
    if (this.recording) this.events.push({ t: "halt", robot: (c as Robot).index });
  }

  // --- simulation ---

  /** Advances by one tick. */
  step(): void {
    if (this.finished) return;
    this.tick++;
    if (this.recording) this.events = [];
    const budget = this.rules.cyclesPerTick;
    for (const r of this.robots) if (!r.out) runTick(r, this, budget);
    this.physics();
    this.checkEnd();
  }

  /** Plays until the end and returns the result. */
  run(): MatchResult {
    while (!this.finished) this.step();
    return this.result!;
  }

  /** Adds paint to a robot; `by` is the robot it comes from, or WALL. */
  private addPaint(r: Robot, amount: number, by: number) {
    if (r.out) return;
    const add = Math.min(amount, 100 - r.paint);
    if (add <= 0) return;
    r.paint += add;
    r.paintBy[by] += add;
    if (this.recording) this.events.push({ t: "paint", robot: r.index, by, amount: add });
  }

  private physics() {
    const R = this.rules, A = this.arena;

    for (const r of this.robots) {
      if (r.out) continue;
      if (r.reload > 0) r.reload--;
      // turning is only possible at low speed; meanwhile the robot slows down
      if (r.heading !== r.dHeading && r.speed <= R.turnSpeed) r.heading = r.dHeading;
      const target = r.heading !== r.dHeading ? Math.min(r.dSpeed, R.turnSpeed) : r.dSpeed;
      if (r.speed < target) r.speed = Math.min(r.speed + R.accel, target);
      else if (r.speed > target) r.speed = Math.max(r.speed - R.accel, target);

      this.prevX[r.index] = r.x;
      this.prevY[r.index] = r.y;
      if (r.speed > 0) {
        // paint weighs the robot down: up to paintSlow% slower at 100%
        const step = Math.floor((r.speed * R.robotMaxStep * (10000 - r.paint * R.paintSlow)) / 1_000_000);
        r.x += roundDiv(icos(r.heading) * step, SCALE);
        r.y += roundDiv(isin(r.heading) * step, SCALE);
        let wall = false;
        if (r.x < 0) { r.x = 0; wall = true; } else if (r.x > A) { r.x = A; wall = true; }
        if (r.y < 0) { r.y = 0; wall = true; } else if (r.y > A) { r.y = A; wall = true; }
        if (wall) {
          // the walls are freshly painted
          r.speed = 0; r.dSpeed = 0;
          this.addPaint(r, R.bump, WALL);
          if (this.recording) this.events.push({ t: "wall", robot: r.index });
        }
      }
    }

    // bumps between robots: both go back to where they were, stop and
    // swap a little paint
    const n = this.robots.length, cd = R.collisionDistance;
    for (let i = 0; i < n; i++) {
      const a = this.robots[i];
      if (a.out) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.robots[j];
        if (b.out || Math.abs(a.x - b.x) >= cd || Math.abs(a.y - b.y) >= cd) continue;
        for (const r of [a, b]) {
          r.x = this.prevX[r.index]; r.y = this.prevY[r.index];
          r.speed = 0; r.dSpeed = 0;
        }
        this.addPaint(a, R.bump, b.index);
        this.addPaint(b, R.bump, a.index);
        if (this.recording) this.events.push({ t: "bump", robot: a.index, other: b.index });
      }
    }

    // splashes (graphics only)
    for (let i = this.splashes.length - 1; i >= 0; i--)
      if (++this.splashes[i].age >= R.splashTicks) this.splashes.splice(i, 1);

    // balloons: they burst at the requested distance or against a wall
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const m = this.balloons[i];
      m.traveled = Math.min(m.traveled + R.balloonStep, m.range);
      m.x = m.sx + roundDiv(icos(m.heading) * m.traveled, SCALE);
      m.y = m.sy + roundDiv(isin(m.heading) * m.traveled, SCALE);
      const outside = m.x < 0 || m.x > A || m.y < 0 || m.y > A;
      if (!outside && m.traveled < m.range) continue;
      m.x = Math.min(Math.max(m.x, 0), A);
      m.y = Math.min(Math.max(m.y, 0), A);
      this.balloons.splice(i, 1);
      this.robots[m.owner].inFlight--;
      this.splashes.push({ owner: m.owner, x: m.x, y: m.y, age: 0 });
      if (this.recording) this.events.push({ t: "splash", robot: m.owner, x: m.x, y: m.y });
      for (const r of this.robots) {
        if (r.out) continue;
        const dx = r.x - m.x, dy = r.y - m.y;
        const amount = splashPaint(R, isqrt(dx * dx + dy * dy));
        if (amount) this.addPaint(r, amount, m.owner);
      }
    }

    for (const r of this.robots) {
      if (!r.out && r.paint >= 100) {
        r.out = true;
        r.outAt = this.tick;
        r.speed = 0;
        if (this.recording) this.events.push({ t: "out", robot: r.index });
      }
    }
  }

  /** Current situation as if the match ended now (a tie among those still in the game). */
  snapshotResult(): MatchResult {
    return {
      winner: -1, reason: "timeout", ticks: this.tick, remaining: this.robots.filter((r) => !r.out).map((r) => r.index),
      paint: this.robots.map((r) => r.paint), cycles: this.robots.map((r) => r.cycles),
    };
  }

  private checkEnd() {
    const inGame = this.robots.filter((r) => !r.out);
    const solo = this.robots.length === 1;
    let reason: MatchResult["reason"] | null = null;
    if (!solo && inGame.length === 1) reason = "victory";
    else if (inGame.length === 0) reason = "draw";
    else if (this.tick >= this.rules.maxTicks) reason = "timeout";
    if (!reason) return;
    this.finished = true;
    this.result = {
      winner: reason === "victory" ? inGame[0].index : -1,
      reason,
      ticks: this.tick,
      remaining: inGame.map((r) => r.index),
      paint: this.robots.map((r) => r.paint),
      cycles: this.robots.map((r) => r.cycles),
    };
  }
}

/** Direction and distance in metres from the robot to a point (useful for tests and graphics). */
export function bearing(r: Robot, x: number, y: number): { dir: number; dist: number } {
  const dx = x * 1000 - r.x, dy = y * 1000 - r.y;
  return { dir: normDeg(iatan2(dy, dx)), dist: Math.floor(isqrt(dx * dx + dy * dy) / 1000) };
}
