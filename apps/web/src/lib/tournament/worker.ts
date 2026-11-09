// Browser tournament worker thread: compiles the robots once, then plays the
// chunks of matches it receives and returns their statistics.

import { compile, playTournamentRange, type Program, type Rules } from "@paintarena/engine";

export type WorkerIn =
  | { type: "init"; sources: string[]; rules: Rules; groups: number[][]; seed: number }
  | { type: "run"; start: number; end: number };

let programs: Program[] = [];
let rules: Rules;
let groups: number[][] = [];
let seed = 0;

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === "init") {
    rules = msg.rules;
    groups = msg.groups;
    seed = msg.seed;
    programs = msg.sources.map((s) => compile(s, rules).program!);
    return;
  }
  const stats = playTournamentRange(programs, groups, seed, rules, msg.start, msg.end);
  self.postMessage({ start: msg.start, end: msg.end, stats });
};
