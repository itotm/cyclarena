import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { compile, Match, message, recordMatch, RULES_V0, rulesForClass, splashPaint, WALL, type Program, type Rules } from "../src/index.ts";
import { iatan2, icos, idist, isin, isqrt } from "../src/math.ts";

const ROBOTS = new URL("../../../robots/", import.meta.url);
const robot = (name: string, lang = "en") => readFileSync(new URL(`${lang}/${name}.pa`, ROBOTS), "utf8");

/** The same sample robots in the two languages: English name, Italian name. */
const PAIRS = [
  ["first", "primo"], ["sprinkler", "irrigatore"], ["wanderer", "vagabondo"], ["spiral", "spirale"],
  ["circuit", "circuito"], ["chaser", "inseguitore"], ["corner", "angolo"], ["marksman", "tiratore"], ["tracker", "segugio"],
  ["mapper", "cartografo"], ["strategist", "stratega"],
];

const UNLIMITED = rulesForClass("unlimited");

function build(src: string, rules?: Rules): Program {
  const r = compile(src, rules);
  assert.ok(r.ok, r.diagnostics.map((d) => `${d.line}:${d.col} ${message(d.code, d.args)}`).join("\n"));
  return r.program!;
}

/** Runs a program on its own and collects its prints. */
function runSolo(src: string, ticks = 50): { prints: string[]; errors: string[] } {
  const m = new Match([{ name: "t", program: build(src) }], { seed: 1, record: true });
  const prints: string[] = [], errors: string[] = [];
  for (let i = 0; i < ticks && !m.finished; i++) {
    m.step();
    for (const e of m.events) {
      if (e.t === "print") prints.push(e.text);
      if (e.t === "error") errors.push(e.code);
    }
  }
  return { prints, errors };
}

test("integer math", () => {
  assert.equal(isin(30), 5000);
  assert.equal(icos(0), 10000);
  assert.equal(isin(-90), -10000);
  assert.equal(icos(180), -10000);
  for (let a = 0; a < 360; a += 7) {
    const y = Math.round(isin(a)), x = Math.round(icos(a));
    assert.equal(iatan2(y, x), a % 360, `atan2 a ${a}`);
  }
  for (let i = 0; i < 2000; i++) {
    const x = (i * 7919) % 2001 - 1000, y = (i * 104729) % 2001 - 1000;
    if (!x && !y) continue;
    let ref = Math.round((Math.atan2(y, x) * 180) / Math.PI);
    if (ref < 0) ref += 360;
    const diff = Math.abs(((iatan2(y, x) - ref) % 360 + 540) % 360 - 180);
    assert.ok(diff <= 1, `atan2(${y}, ${x}) = ${iatan2(y, x)}, expected ${ref}`);
  }
  assert.equal(isqrt(0), 0);
  assert.equal(isqrt(99), 9);
  assert.equal(isqrt(100), 10);
  assert.equal(isqrt(2 ** 52), 2 ** 26);
  assert.equal(idist(3, -4), 5);
  assert.equal(idist(0, 0), 0);
  assert.equal(idist(100_000_000, 0), 100_000_000); // beyond 2^53 when squared and summed
  assert.equal(idist(2147483647, 2147483647), 2147483647); // capped
  assert.equal(idist(-2147483648, 0), 2147483647);
});

test("all example robots compile without errors", () => {
  for (const lang of ["en", "it"]) {
    const dir = new URL(lang + "/", ROBOTS);
    const files = readdirSync(dir).filter((f) => f.endsWith(".pa"));
    assert.equal(files.length, PAIRS.length, lang);
    for (const f of files) {
      const r = compile(readFileSync(new URL(f, dir), "utf8"), UNLIMITED);
      assert.ok(r.ok, f + ": " + r.diagnostics.map((d) => message(d.code, d.args)).join("; "));
      assert.deepEqual(r.diagnostics.filter((d) => d.severity === "warning"), [], f);
    }
  }
});

test("Italian and English example robots are the same program", () => {
  for (const [en, it] of PAIRS) {
    const a = build(robot(en, "en"), UNLIMITED), b = build(robot(it, "it"), UNLIMITED);
    assert.deepEqual([...b.code], [...a.code], `${en} / ${it}`);
    assert.equal(b.globals, a.globals, `${en} / ${it}`);
  }
});

test("32-bit arithmetic as in C", () => {
  const { prints } = runSolo(`
    fn main() {
      print(7 / 2, -7 / 2, 7 % 3, -7 % 3);
      print(2147483647 + 1, -2147483648 - 1);
      print(65536 * 65536, 1 << 31, -16 >> 2);
      print(5 & 3, 5 | 3, 5 ^ 3, ~0, !0, !7);
      print(3 < 4, 3 <= 3, 4 > 5, 1 == 1, 1 != 1);
      print(1 && 0, 1 || 0, 0 || 0, 2 + 3 * 4, (2 + 3) * 4);
    }`);
  assert.deepEqual(prints, [
    "3 -3 1 -1",
    "-2147483648 2147483647",
    "0 -2147483648 -4",
    "1 7 6 -1 1 0",
    "1 1 0 1 0",
    "0 1 0 14 20",
  ]);
});

test("variables, arrays, loops and functions", () => {
  const { prints } = runSolo(`
    const N = 5;
    var a[N];
    var g = 10;
    fn fact(n) { if (n <= 1) { return 1; } return n * fact(n - 1); }
    fn sum() { var s = 0; for (var i = 0; i < N; i++) { s += a[i]; } return s; }
    fn main() {
      for (var i = 0; i < N; i++) { a[i] = i * i; }
      a[2] += 100;
      print("sum", sum(), "fact", fact(6), "g", g);
      var k = 0;
      while (true) { k++; if (k == 3) { continue; } if (k > 5) { break; } }
      print(k);
      var loc[3];
      loc[1] = 4; loc[1] *= 3;
      print(loc[0], loc[1], loc[2]);
    }`);
  assert.deepEqual(prints, ["sum 130 fact 720 g 10", "6", "0 12 0"]);
});

test("runtime errors: the program restarts from main", () => {
  const { prints, errors } = runSolo(`
    var runs = 0;
    var a[3];
    fn down(n) { return down(n + 1); }
    fn main() {
      runs++;
      print("run", runs);
      if (runs == 1) { print(1 / (runs - 1)); }
      if (runs == 2) { a[3] = 1; }
      if (runs == 3) { print(sqrt(-4)); }
      if (runs == 4) { down(0); }
      yield();
      loop { yield(); }
    }`, 2000);
  assert.deepEqual(errors, ["R_DIV0", "R_INDEX", "R_SQRT_NEG", "R_STACK"]);
  assert.deepEqual(prints.slice(0, 4), ["run 1", "run 2", "run 3", "run 4"]);
});

test("cycles are counted exactly", () => {
  // ENTER(1) + [PUSH 0, STG] init... the program only runs yield in a loop
  const p = build(`fn main() { loop { yield(); } }`);
  const m = new Match([{ name: "t", program: p }], { seed: 1 });
  m.step();
  // a tick always consumes the whole budget when yield is called
  assert.equal(m.robots[0].cycles, 50);
  // an instruction that overruns the budget creates a debt for the next tick
  const q = build(`fn main() { loop { var x = 1000 / 3; } }`);
  const m2 = new Match([{ name: "t", program: q }], { seed: 1 });
  for (let i = 0; i < 10; i++) m2.step();
  const r = m2.robots[0];
  assert.ok(r.cycles >= 500 && r.cycles < 510, String(r.cycles));
  assert.ok(r.balance <= 0 && r.balance > -6);
});

test("compiler error messages", () => {
  const code = (src: string) => compile(src).diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
  assert.deepEqual(code(`fn main() { if (x = 1) { } }`), ["E_ASSIGN_IN_EXPR"]);
  assert.deepEqual(code(`fn main() { var d = scna(0, 1); }`), ["E_UNKNOWN_HINT"]);
  assert.deepEqual(code(`fn main() { if (1) print(1); }`), ["E_BRACES"]);
  assert.deepEqual(code(`fn hello() { }`), ["E_NO_MAIN"]);
  assert.deepEqual(code(`const A = 1; fn main() { A = 2; }`), ["E_CONST_ASSIGN"]);
  assert.deepEqual(code(`fn main() { drive(1); }`), ["E_ARGS"]);
  assert.deepEqual(code(`fn main() { break; }`), ["E_BREAK"]);
  assert.deepEqual(code(`var a[0]; fn main() { }`), ["E_ARRAY_SIZE"]);
  assert.deepEqual(code(`fn main() { var x = "hello"; }`), ["E_STRING_PLACE"]);
  assert.deepEqual(code(`fn main() { var x = 1; var x = 2; print(x); }`), ["E_DUP"]);
  assert.deepEqual(code(`fn scan() { } fn main() { }`), ["E_BUILTIN_NAME"]);
  assert.equal(message("E_UNKNOWN_HINT", ["scna", "scan"], "it"), "Nome sconosciuto «scna»: forse intendevi «scan»?");
  assert.equal(message("E_BRACES", ["if"], "en"), "The body of if must be written in braces { … }");
});

test("deterministic matches: same seed, same result", () => {
  const names = ["sprinkler", "wanderer", "corner", "chaser"];
  const entrants = names.map((n) => ({ name: n, program: build(robot(n)) }));
  for (const seed of [1, 2, 3, 12345]) {
    const a = new Match(entrants, { seed }).run();
    const b = new Match(entrants, { seed }).run();
    const c = recordMatch(entrants, { seed }).result;
    assert.deepEqual(a, b);
    assert.deepEqual(a, c);
  }
});

test("reference results (change only when the rules change)", () => {
  // if this test fails after an intended change to the rules or costs,
  // update the values and the rules version (RULES_V0.version)
  const names = ["sprinkler", "wanderer", "corner", "chaser"];
  const entrants = names.map((n) => ({ name: n, program: build(robot(n)) }));
  const r = new Match(entrants, { seed: 42 }).run();
  assert.deepEqual({ winner: r.winner, ticks: r.ticks, paint: r.paint, cycles: r.cycles }, {
    winner: 1, ticks: 268, paint: [100, 0, 100, 100], cycles: [8750, 13400, 13400, 10800],
  });
});

test("classes: code and memory limits", async () => {
  const { rulesForClass, smallestClass } = await import("../src/index.ts");
  const classOf = (n: string) => { const p = build(robot(n), UNLIMITED); return smallestClass(p.size, p.globals); };
  for (const n of ["first", "sprinkler", "wanderer", "spiral", "circuit", "chaser", "corner", "marksman"]) assert.equal(classOf(n), "micro", n);
  assert.equal(classOf("tracker"), "mini");
  assert.equal(classOf("mapper"), "standard");
  assert.equal(classOf("strategist"), "unlimited");
  const r = compile(robot("tracker"), rulesForClass("micro"));
  assert.ok(!r.ok);
  assert.equal(r.diagnostics[0].code, "E_CODE_SIZE");
  assert.equal(message(r.diagnostics[0].code, r.diagnostics[0].args, "it"), `Programma troppo lungo per la classe Micro: ${build(robot("tracker")).size} istruzioni, al massimo 256`);
  assert.ok(compile(robot("tracker"), rulesForClass("mini")).ok);
  const big = compile("var a[500]; fn main() { a[0] = 1; }", rulesForClass("micro"));
  assert.deepEqual(big.diagnostics.map((d) => d.code), ["E_MEMORY"]);
  assert.ok(compile("var a[500]; fn main() { a[0] = 1; }", rulesForClass("mini")).ok);
  // same match in different classes: same result (only the limits change)
  const entrants = ["sprinkler", "wanderer"].map((n) => ({ name: n, program: build(robot(n)) }));
  const a = new Match(entrants, { seed: 5, rules: rulesForClass("micro") }).run();
  const b = new Match(entrants, { seed: 5, rules: rulesForClass("unlimited") }).run();
  assert.deepEqual(a, b);
});

test("tournaments: statistics do not depend on how matches are split", async () => {
  const { tournamentGroups, playTournamentRange, emptyStats, mergeStats, RULES_V0 } = await import("../src/index.ts");
  const programs = ["sprinkler", "wanderer", "chaser", "spiral"].map((n) => build(robot(n)));
  assert.equal(tournamentGroups(4, 2).length, 6);
  assert.equal(tournamentGroups(4, 3).length, 4);
  assert.equal(tournamentGroups(4, 4).length, 1);
  assert.equal(tournamentGroups(5, 4).length, 5);
  const groups = tournamentGroups(4, 3);
  const whole = playTournamentRange(programs, groups, 7, RULES_V0, 0, 60);
  const parts = emptyStats(4);
  for (const [a, b] of [[40, 60], [0, 13], [13, 40]]) mergeStats(parts, playTournamentRange(programs, groups, 7, RULES_V0, a, b));
  assert.deepEqual(parts, whole);
  assert.equal(whole.matches, 60);
  assert.equal(whole.played.reduce((a, b) => a + b, 0), 180);
  assert.equal(whole.ticksHist.reduce((a, b) => a + b, 0), 60);
  // every match has at most one winner
  assert.ok(whole.wins.reduce((a, b) => a + b, 0) <= 60);
  // head-to-head: ahead + behind + level = matches together
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b)
    assert.ok(whole.ahead[a * 4 + b] + whole.ahead[b * 4 + a] <= whole.meetings[a * 4 + b]);
});

// --- paint ---

const STILL = "fn main() { loop { yield(); } }";

/** A match where robot 0 runs `src` and the others stand still at the given positions. */
function paintMatch(src: string, positions: { x: number; y: number }[], paint?: number[]) {
  const entrants = positions.map((_, i) => ({ name: String(i), program: build(i === 0 ? src : STILL) }));
  return new Match(entrants, { seed: 3, positions, paint, record: true });
}

test("splash levels: 25% at the centre, less and less farther away", () => {
  assert.deepEqual(RULES_V0.splash.map((l) => l.paint), [25, 21, 17, 13, 9, 5]);
  assert.equal(splashPaint(RULES_V0, 0), 25);
  assert.equal(splashPaint(RULES_V0, 5000), 25);
  assert.equal(splashPaint(RULES_V0, 5001), 21);
  assert.equal(splashPaint(RULES_V0, 40000), 5);
  assert.equal(splashPaint(RULES_V0, 40001), 0);
  // a balloon thrown at a still robot 300 m away: 25%, credited to the thrower
  const m = paintMatch("fn main() { throw(0, 300); loop { yield(); } }", [{ x: 100, y: 500 }, { x: 400, y: 500 }]);
  for (let i = 0; i < 10; i++) m.step();
  assert.equal(m.robots[1].paint, 25);
  assert.deepEqual(m.robots[1].paintBy, [25, 0, 0, 0, 0]);
});

test("a robot at 100% is out of the game, not destroyed", () => {
  // four throws at the same spot: 4 × 25 = 100
  const src = "fn main() { loop { throw(0, 300); } }";
  const m = paintMatch(src, [{ x: 100, y: 500 }, { x: 400, y: 500 }, { x: 900, y: 900 }]);
  let outEvents = 0;
  while (!m.robots[1].out && m.tick < 200) { m.step(); outEvents += m.events.filter((e) => e.t === "out").length; }
  assert.equal(m.robots[1].paint, 100);
  assert.equal(outEvents, 1);
  // once out it is invisible to the radar and takes no more paint
  const r = m.robots[1].paint;
  for (let i = 0; i < 40; i++) m.step();
  assert.equal(m.robots[1].paint, r);
  assert.equal(m.scan(m.robots[0], 0, 5), 0);
});

test("paint slows a robot down: −25% at 100%", () => {
  const go = "fn main() { drive(0, 100); loop { yield(); } }";
  const travel = (paint: number) => {
    const m = paintMatch(go, [{ x: 100, y: 500 }], [paint]);
    for (let i = 0; i < 40; i++) m.step();
    return m.robots[0].x - 100_000;
  };
  const clean = travel(0), half = travel(50), full = travel(99);
  assert.ok(half < clean && full < half, `${clean} ${half} ${full}`);
  // at full speed: 7000 mm per tick clean, 75.25% of it at 99%
  const m = paintMatch(go, [{ x: 100, y: 500 }], [99]);
  for (let i = 0; i < 20; i++) m.step();
  const before = m.robots[0].x;
  m.step();
  assert.equal(m.robots[0].x - before, Math.floor((100 * 7000 * (10000 - 99 * 25)) / 1_000_000));
});

test("paint blurs the radar: distance error up to ±10% at 100%", () => {
  const read = (paint: number) => {
    const m = paintMatch(STILL, [{ x: 100, y: 500 }, { x: 600, y: 500 }], [paint]);
    const seen: number[] = [];
    for (let i = 0; i < 400; i++) seen.push(m.scan(m.robots[0], 0, 2));
    return seen;
  };
  assert.ok(read(0).every((d) => d === 500));
  const blurred = read(90);
  assert.ok(blurred.every((d) => d >= 455 && d <= 545), String(Math.min(...blurred)) + " " + String(Math.max(...blurred)));
  assert.ok(new Set(blurred).size > 20);
  // the direction stays exact: nothing is seen where there is nobody
  const m = paintMatch(STILL, [{ x: 100, y: 500 }, { x: 600, y: 500 }], [90]);
  assert.equal(m.scan(m.robots[0], 180, 10), 0);
});

test("fresh paint on the walls, and a little paint swapped when robots bump", () => {
  const m = paintMatch("fn main() { drive(180, 100); loop { yield(); } }", [{ x: 30, y: 500 }]);
  for (let i = 0; i < 30; i++) m.step();
  assert.equal(m.robots[0].paint, RULES_V0.bump);
  assert.equal(m.robots[0].paintBy[WALL], RULES_V0.bump);
  const b = paintMatch("fn main() { drive(0, 30); loop { yield(); } }", [{ x: 100, y: 500 }, { x: 110, y: 500 }]);
  for (let i = 0; i < 20; i++) b.step();
  assert.equal(b.robots[0].paintBy[1], RULES_V0.bump);
  assert.equal(b.robots[1].paintBy[0], RULES_V0.bump);
});

test("coordinate functions: same result as the formulas they replace", () => {
  // robot at (300, 250), points all around, including far outside the arena
  const pts = [[750, 600], [300, 900], [10, 250], [300, 250], [-5000, 123], [999, 1], [301, 251]];
  const calls = pts.map(([x, y]) => `
    print(dir_to(${x}, ${y}), atan2(${y} - loc_y(), ${x} - loc_x()));
    print(dist_to(${x}, ${y}), sqrt((${x} - loc_x()) * (${x} - loc_x()) + (${y} - loc_y()) * (${y} - loc_y())));`).join("");
  const polar = [[0, 100], [45, 570], [123, 333], [270, 40], [-30, 77], [400, 1], [181, 0]].map(([d, r]) => `
    print(point_x(${d}, ${r}), loc_x() + ${r} * cos(${d}) / SCALE);
    print(point_y(${d}, ${r}), loc_y() + ${r} * sin(${d}) / SCALE);`).join("");
  const src = `fn main() { ${calls} ${polar} loop { yield(); } }`;
  const m = new Match([{ name: "t", program: build(src, UNLIMITED) }], { seed: 1, record: true, rules: UNLIMITED, positions: [{ x: 300, y: 250 }] });
  const prints: string[] = [];
  for (let i = 0; i < 40; i++) { m.step(); for (const e of m.events) if (e.t === "print") prints.push(e.text); }
  assert.equal(prints.length, pts.length * 2 + 14);
  for (const p of prints) { const [a, b] = p.split(" "); assert.equal(a, b, p); }
});

test("coordinate functions cost as much as the code they replace", () => {
  const cost = (body: string) => {
    const p = build(`fn f(x, y, d, s) {\n${body};\n}\nfn main() { f(1, 2, 3, 4); }`);
    return p.lineCost[2];
  };
  assert.equal(cost("var r = dir_to(x, y)"), cost("var r = atan2(y - loc_y(), x - loc_x())"));
  assert.equal(cost("var r = point_x(d, s)"), cost("var r = loc_x() + s * cos(d) / SCALE"));
  assert.equal(cost("var r = point_y(d, s)"), cost("var r = loc_y() + s * sin(d) / SCALE"));
  assert.equal(cost("drive_to(x, y, s)"), cost("drive(atan2(y - loc_y(), x - loc_x()), s)"));
  // distance: with dx and dy computed once, as a careful programmer would
  const careful = "var dx = x - loc_x(); var dy = y - loc_y(); ";
  assert.equal(cost("var r = dist_to(x, y)"), cost(careful + "var r = sqrt(dx * dx + dy * dy)"));
  assert.equal(cost("var r = throw_at(x, y)"), cost(careful + "var r = throw(atan2(dy, dx), sqrt(dx * dx + dy * dy))"));
});

test("drive_to and throw_at act like drive and throw towards the point", () => {
  const m = new Match([{ name: "t", program: build(`fn main() { drive_to(600, 650, 100); var ok = throw_at(400, 350); loop { yield(); } }`) }],
    { seed: 1, positions: [{ x: 300, y: 250 }] });
  m.step();
  assert.equal(m.robots[0].dHeading, iatan2(400, 300));
  assert.equal(m.balloons.length, 1);
  assert.equal(m.balloons[0].heading, 45);
  assert.equal(m.balloons[0].range, 141_000);
});
