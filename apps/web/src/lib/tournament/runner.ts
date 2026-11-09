// Runs a tournament in the browser: splits the matches into chunks and
// spreads them over several threads (Web Workers). Chunk statistics are
// added up as they arrive; the final result does not depend on the thread count.

import { emptyStats, mergeStats, tournamentGroups, type Rules, type TournamentStats } from "@paintarena/engine";
import type { WorkerIn } from "./worker.ts";

export interface TournamentSetup {
  sources: string[];
  rules: Rules;
  /** Robots per match: 2, 3 or 4. */
  size: number;
  matches: number;
  seed: number;
}

export interface Progress {
  done: number;
  stats: TournamentStats;
  seconds: number;
}

export function threadCount(): number {
  const n = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(16, n - 1));
}

/**
 * Starts the tournament. `onprogress` receives the cumulative statistics after
 * each chunk; the promise resolves at the end (or when stop() is called).
 */
export function runTournament(setup: TournamentSetup, onprogress: (p: Progress) => void) {
  const groups = tournamentGroups(setup.sources.length, setup.size);
  const stats = emptyStats(setup.sources.length);
  const total = setup.matches;
  // small chunks at first (results visible right away), then larger ones
  const chunk = Math.max(20, Math.min(2000, Math.ceil(total / 400)));
  const workers: Worker[] = [];
  let next = 0, done = 0, stopped = false;
  const t0 = performance.now();
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => (finish = resolve));

  const end = () => {
    for (const w of workers) w.terminate();
    workers.length = 0;
    finish();
  };

  const give = (w: Worker) => {
    if (stopped || next >= total) return false;
    const start = next;
    next = Math.min(total, next + chunk);
    w.postMessage({ type: "run", start, end: next } satisfies WorkerIn);
    return true;
  };

  const n = Math.min(threadCount(), Math.ceil(total / chunk));
  for (let k = 0; k < n; k++) {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    w.postMessage({ type: "init", sources: setup.sources, rules: setup.rules, groups, seed: setup.seed } satisfies WorkerIn);
    w.onmessage = (e: MessageEvent<{ start: number; end: number; stats: TournamentStats }>) => {
      if (stopped) return;
      mergeStats(stats, e.data.stats);
      done += e.data.end - e.data.start;
      onprogress({ done, stats, seconds: (performance.now() - t0) / 1000 });
      if (done >= total) end();
      else give(w);
    };
    w.onerror = (err) => { console.error(err); stopped = true; end(); };
    workers.push(w);
    give(w);
  }

  return {
    finished,
    stop() {
      stopped = true;
      end();
    },
  };
}
