#!/usr/bin/env node
// paintarena from the command line: compile, play matches, run tournaments.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import {
  compile, disassemble, formatDiagnostic, Match, message, MIN_STACK, POINTS_SURVIVE, POINTS_WIN, recordMatch, ROBOT_CLASSES, rulesForClass, smallestClass,
  type Lang, type Program, type RobotClassId, type Rules,
} from "@paintarena/engine";
import { planTournament, type Job, type JobResult, type TournamentKind } from "./tournament.ts";

// clean exit if the output is cut short (for example with `| head`)
process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); else throw e; });

// language: PAINTARENA_LANG variable, then LANG, then the system language (Windows has no LANG)
const envLang = process.env.PAINTARENA_LANG || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
const lang: Lang = envLang.startsWith("it") ? "it" : "en";
const t = (it: string, en: string) => (lang === "it" ? it : en);

function usage(): never {
  console.log(t(
    `Uso:
  Opzione comune: --class micro|mini|standard|unlimited (predefinita: standard)
  paintarena compile <robot.pa> [--asm]          controlla un robot e mostra il costo di ogni riga
  paintarena match <robot.pa>... [--seed N] [--log]   gioca una partita (da 2 a 4 robot)
  paintarena tournament <robot.pa>... [--mode duel|melee] [--size 2|3|4] [--rounds N] [--seed N] [--jobs N] [--json]
                                               torneo: duel = tutti contro tutti 1 contro 1,
                                               melee = tutti i gruppi di 4`,
    `Usage:
  Common option: --class micro|mini|standard|unlimited (default: standard)
  paintarena compile <robot.pa> [--asm]          check a robot and show the cost of each line
  paintarena match <robot.pa>... [--seed N] [--log]   play one match (2 to 4 robots)
  paintarena tournament <robot.pa>... [--mode duel|melee] [--size 2|3|4] [--rounds N] [--seed N] [--jobs N] [--json]
                                               tournament: duel = round robin 1 vs 1,
                                               melee = every group of 4`));
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const files: string[] = [];
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--") && !["asm", "log", "json"].includes(key)) { opts.set(key, next); i++; }
      else opts.set(key, "true");
    } else files.push(a);
  }
  return { files, opts };
}

const robotName = (file: string) => basename(file).replace(/\.pa$/, "");

let rules: Rules = rulesForClass("standard");

function load(file: string): { name: string; source: string; program: Program } {
  const source = readFileSync(file, "utf8");
  const res = compile(source, rules);
  for (const d of res.diagnostics) console.error(formatDiagnostic(d, lang, file));
  if (!res.ok) process.exit(1);
  return { name: robotName(file), source, program: res.program! };
}

function cmdCompile(files: string[], opts: Map<string, string>) {
  if (files.length !== 1) usage();
  const { source, program } = load(files[0]);
  const src = source.split("\n");
  if (opts.has("asm")) {
    const asm = disassemble(program);
    let lastLine = -1;
    for (const a of asm) {
      if (a.line !== lastLine) { console.log(`\n${String(a.line).padStart(4)} | ${src[a.line - 1] ?? ""}`); lastLine = a.line; }
      console.log(`       ${String(a.pc).padStart(5)}  ${a.text.padEnd(28)} ${a.cost}`);
    }
  } else {
    for (let i = 0; i < src.length; i++) {
      const c = program.lineCost[i + 1];
      const cost = c ? String(c) + (program.lineDynamic[i + 1] ? "+" : " ") : "";
      console.log(`${cost.padStart(5)} ${String(i + 1).padStart(4)} | ${src[i]}`);
    }
  }
  const cls = message("CLASS_" + smallestClass(program.size, program.globals), [], lang);
  const cur = message("CLASS_" + rules.robotClass, [], lang);
  const pct = (a: number, b: number) => (b >= 100_000 ? "" : ` (${Math.round((a / b) * 100)}%)`);
  const max = (b: number) => (b >= 100_000 ? "∞" : String(b));
  const memMax = rules.memorySize - MIN_STACK;
  console.log(t(
    `\nClasse ${cur}: codice ${program.size}/${max(rules.maxCodeSize)} istruzioni${pct(program.size, rules.maxCodeSize)}, memoria ${program.globals}/${max(memMax)} parole${pct(program.globals, memMax)}. Classe minima: ${cls}`,
    `\n${cur} class: code ${program.size}/${max(rules.maxCodeSize)} instructions${pct(program.size, rules.maxCodeSize)}, memory ${program.globals}/${max(memMax)} words${pct(program.globals, memMax)}. Smallest class: ${cls}`));
}

function cmdMatch(files: string[], opts: Map<string, string>) {
  if (files.length < 2 || files.length > 4) usage();
  const robots = files.map(load);
  const seed = Number(opts.get("seed") ?? Date.now() % 1e9);
  const entrants = robots.map((r) => ({ name: r.name, program: r.program }));
  if (opts.has("log")) {
    const rep = recordMatch(entrants, { seed, rules });
    for (const f of rep.frames) for (const e of f.events) {
      const who = rep.names[e.robot];
      if (e.t === "print") console.log(`[${f.tick}] ${who}: ${e.text}`);
      else if (e.t === "error") console.log(`[${f.tick}] ${who}: ${message("R_RESTART", [{ code: e.code, args: e.args }, e.line], lang)}`);
      else if (e.t === "out") console.log(`[${f.tick}] ${who}: ${t("fuori gioco", "out of the game")}`);
      else if (e.t === "halt") console.log(`[${f.tick}] ${who}: ${message("R_HALT", [], lang)}`);
    }
    printResult(rep.names, rep.result, seed);
  } else {
    const m = new Match(entrants, { seed, rules });
    printResult(robots.map((r) => r.name), m.run(), seed);
  }
}

function printResult(names: string[], r: import("@paintarena/engine").MatchResult, seed: number) {
  const outcome = r.reason === "victory" ? t(`vince ${names[r.winner]}`, `${names[r.winner]} wins`)
    : r.reason === "draw" ? t("tutti fuori gioco: pareggio", "everyone out: draw")
    : t("tempo scaduto: pareggio tra chi è ancora in gioco", "time out: draw between those still in the game");
  console.log(t(`Seed ${seed}, ${r.ticks} tick: ${outcome}`, `Seed ${seed}, ${r.ticks} ticks: ${outcome}`));
  names.forEach((n, i) => console.log(`  ${n.padEnd(20)} ${t("vernice", "paint")} ${String(r.paint[i]).padStart(3)}%  ${t("cicli", "cycles")} ${r.cycles[i]}`));
}

// In the executable built by bun the worker is embedded as src/worker.ts
// (`$bunfs` paths on Linux/macOS, `~BUN` on Windows).
function workerUrl(): string | URL {
  const compiled = import.meta.url.includes("$bunfs") || import.meta.url.includes("~BUN");
  return compiled ? "./src/worker.ts" : new URL("./worker.ts", import.meta.url);
}

async function cmdTournament(files: string[], opts: Map<string, string>) {
  if (files.length < 2) usage();
  const robots = files.map(load);
  const kind = (opts.get("mode") ?? "duel") as TournamentKind;
  if (kind !== "duel" && kind !== "melee") usage();
  const rounds = Number(opts.get("rounds") ?? 100);
  const seed = Number(opts.get("seed") ?? 1);
  const size = opts.has("size") ? Number(opts.get("size")) : undefined;
  const jobsOpt = Number(opts.get("jobs") ?? availableParallelism());
  if ((size !== undefined && !(size >= 2 && size <= 4)) || !Number.isInteger(rounds) || rounds < 1
    || !Number.isInteger(seed) || !Number.isInteger(jobsOpt) || jobsOpt < 1) usage();
  const jobs = planTournament(robots.length, kind, rounds, seed, size);
  const nWorkers = Math.min(jobsOpt, Math.max(1, Math.ceil(jobs.length / 50)));
  const sources = robots.map((r) => r.source);

  const t0 = performance.now();
  const chunks: Job[][] = Array.from({ length: nWorkers }, () => []);
  jobs.forEach((j, i) => chunks[i % nWorkers].push(j));
  const results = (await Promise.all(chunks.map((chunk) => new Promise<JobResult[]>((resolve, reject) => {
    const w = new Worker(workerUrl(), { workerData: { sources, jobs: chunk, robotClass: rules.robotClass } });
    w.once("message", resolve);
    w.once("error", reject);
  })))).flat();
  const secs = (performance.now() - t0) / 1000;

  // scoring: POINTS_WIN for the winner, POINTS_SURVIVE for each robot still in the game at a time-out draw
  const score = robots.map(() => ({ points: 0, wins: 0, ties: 0, losses: 0, played: 0 }));
  let totalCycles = 0, totalTicks = 0;
  for (const r of results) {
    totalCycles += r.cycles; totalTicks += r.ticks;
    for (const p of r.players) {
      const s = score[p];
      s.played++;
      if (r.winner === p) { s.wins++; s.points += POINTS_WIN; }
      else if (r.winner < 0 && r.remaining.includes(p)) { s.ties++; s.points += POINTS_SURVIVE; }
      else s.losses++;
    }
  }
  const table = robots.map((r, i) => ({ name: r.name, ...score[i] })).sort((a, b) => b.points - a.points);
  if (opts.has("json")) {
    console.log(JSON.stringify({ kind, robotClass: rules.robotClass, rounds, seed, matches: results.length, seconds: secs, table }, null, 2));
    return;
  }
  console.log(t(`Torneo ${kind}, classe ${message("CLASS_" + rules.robotClass, [], lang)}: ${results.length} partite in ${secs.toFixed(2)} s con ${nWorkers} thread`,
    `${kind} tournament, ${message("CLASS_" + rules.robotClass, [], lang)} class: ${results.length} matches in ${secs.toFixed(2)} s on ${nWorkers} threads`));
  console.log(t(`  ${(results.length / secs).toFixed(0)} partite/s, ${(totalCycles / secs / 1e6).toFixed(0)} milioni di cicli/s, media ${(totalTicks / results.length).toFixed(0)} tick a partita`,
    `  ${(results.length / secs).toFixed(0)} matches/s, ${(totalCycles / secs / 1e6).toFixed(0)} million cycles/s, average ${(totalTicks / results.length).toFixed(0)} ticks per match`));
  console.log();
  console.log(`  ${"#".padStart(2)} ${t("robot", "robot").padEnd(20)} ${t("punti", "points").padStart(7)} ${t("vinte", "won").padStart(6)} ${t("pari", "tied").padStart(6)} ${t("perse", "lost").padStart(6)}`);
  table.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)} ${r.name.padEnd(20)} ${String(r.points).padStart(7)} ${String(r.wins).padStart(6)} ${String(r.ties).padStart(6)} ${String(r.losses).padStart(6)}`));
}

const [cmd, ...rest] = process.argv.slice(2);
const { files, opts } = parseArgs(rest);
const cls = opts.get("class") ?? "standard";
if (!ROBOT_CLASSES.some((c) => c.id === cls)) usage();
rules = rulesForClass(cls as RobotClassId);
switch (cmd) {
  case "compile": cmdCompile(files, opts); break;
  case "match": cmdMatch(files, opts); break;
  case "tournament": await cmdTournament(files, opts); break;
  default: usage();
}
