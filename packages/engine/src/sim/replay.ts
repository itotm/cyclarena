// Recording of a whole match, tick by tick, to watch it again with the
// graphics (forward, backward, in slow motion). The whole match is computed
// up front: even the longest ones take a few milliseconds.

import { Match, type Entrant, type MatchEvent, type MatchOptions, type MatchResult } from "./match.ts";

export interface RobotFrame {
  x: number; y: number; // metres, with decimals
  heading: number; speed: number;
  /** Paint on the robot, 0–100. */
  paint: number;
  /** Paint by origin: one entry per robot, then the walls. */
  paintBy: number[];
  out: boolean;
  /** Direction and half-width of the last scan, if made in this tick or the 2 before. */
  scan: { dir: number; res: number } | null;
  cycles: number;
}

export interface Frame {
  tick: number;
  robots: RobotFrame[];
  /** Balloons in flight; `f` is how far along the throw they are, 0–1. */
  balloons: { owner: number; x: number; y: number; f: number }[];
  splashes: { owner: number; x: number; y: number; age: number }[];
  events: MatchEvent[];
}

export interface Replay {
  names: string[];
  seed: number;
  frames: Frame[];
  result: MatchResult;
  /** Cycles spent per instruction, one array per robot (if requested). */
  profiles: (Float64Array | null)[];
}

function snapshot(m: Match): Frame {
  return {
    tick: m.tick,
    robots: m.robots.map((r) => ({
      x: r.x / 1000, y: r.y / 1000, heading: r.heading, speed: r.speed, paint: r.paint, paintBy: [...r.paintBy], out: r.out,
      scan: m.tick - r.scanTick <= 2 ? { dir: r.scanDir, res: r.scanRes } : null,
      cycles: r.cycles,
    })),
    balloons: m.balloons.map((b) => ({ owner: b.owner, x: b.x / 1000, y: b.y / 1000, f: b.range > 0 ? b.traveled / b.range : 1 })),
    splashes: m.splashes.map((e) => ({ owner: e.owner, x: e.x / 1000, y: e.y / 1000, age: e.age })),
    events: m.events,
  };
}

/**
 * Plays and records a match. `until`, if given, stops the recording
 * before the end (for example when a mission is accomplished).
 */
export function recordMatch(entrants: Entrant[], opts: MatchOptions & { until?: (m: Match) => boolean }): Replay {
  const m = new Match(entrants, { ...opts, record: true });
  const frames: Frame[] = [snapshot(m)];
  while (!m.finished) {
    m.step();
    frames.push(snapshot(m));
    if (opts.until?.(m)) break;
  }
  return {
    names: entrants.map((e) => e.name),
    seed: opts.seed,
    frames,
    result: m.result ?? m.snapshotResult(),
    profiles: m.robots.map((r) => r.profile),
  };
}
