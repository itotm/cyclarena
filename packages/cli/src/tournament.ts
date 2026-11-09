// Tournament planning: each match is described by its players and seed,
// so anyone can replay it and get the same result.

import { tournamentGroups, tournamentSeed } from "@paintarena/engine";

export type TournamentKind = "duel" | "melee";

export interface Job { players: number[]; seed: number }

export interface JobResult {
  players: number[];
  winner: number;     // robot index in the tournament, or -1
  remaining: number[];
  ticks: number;
  cycles: number;
}

/** Groups of 2 robots (duel), of 4 (melee) or of the given size. */
export function planTournament(robots: number, kind: TournamentKind, rounds: number, seed: number, size?: number): Job[] {
  const groups = tournamentGroups(robots, Math.min(size ?? (kind === "duel" ? 2 : 4), robots));
  const jobs: Job[] = [];
  groups.forEach((players, g) => {
    for (let r = 0; r < rounds; r++) jobs.push({ players, seed: tournamentSeed(seed, g, r) });
  });
  return jobs;
}
