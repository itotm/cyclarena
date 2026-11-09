// Tournament worker thread: compiles the robots once and plays its matches.

import { parentPort, workerData } from "node:worker_threads";
import { compile, Match, rulesForClass, type RobotClassId } from "@paintarena/engine";
import type { Job, JobResult } from "./tournament.ts";

const { sources, jobs, robotClass } = workerData as { sources: string[]; jobs: Job[]; robotClass: RobotClassId };
const rules = rulesForClass(robotClass);
const programs = sources.map((s) => compile(s, rules).program!);

const results: JobResult[] = jobs.map((job) => {
  const m = new Match(job.players.map((p) => ({ name: String(p), program: programs[p] })), { seed: job.seed, rules });
  const r = m.run();
  return {
    players: job.players,
    winner: r.winner < 0 ? -1 : job.players[r.winner],
    remaining: r.remaining.map((i) => job.players[i]),
    ticks: r.ticks,
    cycles: r.cycles.reduce((a, b) => a + b, 0),
  };
});
parentPort!.postMessage(results);
