// Tournaments: scheduling and statistics, shared by the command line and the website.
//
// A tournament fields every possible group of `size` robots (all pairs
// for duels, all triples, all quadruples) and has them play in
// turn: match number i belongs to group i % G, in round floor(i / G). The seed
// of each match depends only on the tournament seed, the group and the round, so
// anyone can replay it, and the results do not depend on how many threads work
// or on the order in which they finish.

import { mixSeed } from "../math.ts";
import type { Program } from "../vm/program.ts";
import type { Rules } from "../rules.ts";
import { Match } from "./match.ts";

/** All groups of `size` robots chosen among `robots` (indices in increasing order). */
export function tournamentGroups(robots: number, size: number): number[][] {
  const out: number[][] = [];
  const pick = (start: number, acc: number[]) => {
    if (acc.length === size) { out.push([...acc]); return; }
    for (let i = start; i < robots; i++) { acc.push(i); pick(i + 1, acc); acc.pop(); }
  };
  if (size >= 1 && size <= robots) pick(0, []);
  return out;
}

/** Seed of the match of group `group` in round `round`. */
export function tournamentSeed(seed: number, group: number, round: number): number {
  return mixSeed(mixSeed(seed, group), round);
}

/** Group and seed of match number `i` of the tournament. */
export function tournamentMatch(groups: number[][], seed: number, i: number): { players: number[]; seed: number } {
  const g = i % groups.length;
  return { players: groups[g], seed: tournamentSeed(seed, g, Math.floor(i / groups.length)) };
}

/** Points: 3 for a win, 1 for each robot still in the game when time runs out. */
export const POINTS_WIN = 3;
export const POINTS_SURVIVE = 1;

/** Cumulative statistics of a tournament (or of part of one): they can be added together. */
export interface TournamentStats {
  robots: number;
  matches: number;
  /** Per robot. */
  played: number[];
  wins: number[];
  /** Still in the game when time runs out, with no winner. */
  ties: number[];
  points: number[];
  /** Sum of the paint taken. */
  paint: number[];
  /** Sum of placings (1 = first; robots that finish level get the same placing). */
  place: number[];
  /**
   * Head-to-head (n × n): ahead[a * n + b] = times a finished ahead
   * of b; meetings[a * n + b] = matches played together. A robot still in the game
   * is ahead of one that is out; between two that are out, the one that lasted longer is ahead.
   */
  ahead: number[];
  meetings: number[];
  /** Match length: histogram with `HIST_BINS` equal bins up to maxTicks. */
  ticksHist: number[];
  ticksSum: number;
  timeouts: number;
  /** Matches that ended with everyone out at the same time. */
  draws: number;
}

export const HIST_BINS = 40;

export function emptyStats(robots: number): TournamentStats {
  const z = (k: number) => new Array<number>(k).fill(0);
  return {
    robots, matches: 0,
    played: z(robots), wins: z(robots), ties: z(robots), points: z(robots), paint: z(robots), place: z(robots),
    ahead: z(robots * robots), meetings: z(robots * robots),
    ticksHist: z(HIST_BINS), ticksSum: 0, timeouts: 0, draws: 0,
  };
}

/** Adds `from` into `into`. */
export function mergeStats(into: TournamentStats, from: TournamentStats): void {
  into.matches += from.matches;
  into.ticksSum += from.ticksSum;
  into.timeouts += from.timeouts;
  into.draws += from.draws;
  const add = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) a[i] += b[i]; };
  add(into.played, from.played); add(into.wins, from.wins); add(into.ties, from.ties); add(into.points, from.points);
  add(into.paint, from.paint); add(into.place, from.place); add(into.ahead, from.ahead); add(into.meetings, from.meetings);
  add(into.ticksHist, from.ticksHist);
}

/** Adds a finished match to the statistics; `players` are the robots' indices in the tournament. */
export function addMatch(s: TournamentStats, players: number[], m: Match): void {
  const r = m.result!;
  const n = s.robots;
  s.matches++;
  s.ticksSum += r.ticks;
  if (r.reason === "timeout") s.timeouts++;
  if (r.reason === "draw") s.draws++;
  s.ticksHist[Math.min(HIST_BINS - 1, Math.floor((r.ticks * HIST_BINS) / (m.rules.maxTicks + 1)))]++;
  // lifetime: a robot still in the game counts more than any that is out
  const life = m.robots.map((rb) => (rb.out ? rb.outAt : Infinity));
  players.forEach((p, i) => {
    const rb = m.robots[i];
    s.played[p]++;
    s.paint[p] += rb.paint;
    let place = 1;
    for (let j = 0; j < players.length; j++) if (life[j] > life[i]) place++;
    s.place[p] += place;
    if (r.winner === i) { s.wins[p]++; s.points[p] += POINTS_WIN; }
    else if (r.reason === "timeout" && !rb.out) { s.ties[p]++; s.points[p] += POINTS_SURVIVE; }
    players.forEach((q, j) => {
      if (i === j) return;
      s.meetings[p * n + q]++;
      if (life[i] > life[j]) s.ahead[p * n + q]++;
    });
  });
}

/** Plays the matches from `start` (inclusive) to `end` (exclusive) and returns their statistics. */
export function playTournamentRange(programs: Program[], groups: number[][], seed: number, rules: Rules, start: number, end: number): TournamentStats {
  const s = emptyStats(programs.length);
  for (let i = start; i < end; i++) {
    const job = tournamentMatch(groups, seed, i);
    const m = new Match(job.players.map((p) => ({ name: String(p), program: programs[p] })), { seed: job.seed, rules });
    m.run();
    addMatch(s, job.players, m);
  }
  return s;
}
