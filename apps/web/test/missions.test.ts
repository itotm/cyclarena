// Every mission must be solvable, and the starter code must not already
// solve it (otherwise it teaches nothing).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile, type Program } from "@paintarena/engine";
import { GROUPS, MISSIONS, missionOpponents, missionRules, playMission, type Mission } from "../src/lib/missions.ts";

const sample = (id: string) => readFileSync(new URL(`../../../robots/en/${id}.pa`, import.meta.url), "utf8");

const SOLUTIONS: Record<string, string> = {
  move: "fn main() { drive(atan2(600 - loc_y(), 750 - loc_x()), 100); }",
  stop: "fn main() { drive(0, 100); while (650 - loc_x() > 35) { yield(); } drive(0, 0); loop { yield(); } }",
  tour: `var fx[4];
var fy[4];
fn main() {
  fx[0] = 300; fy[0] = 200; fx[1] = 800; fy[1] = 300; fx[2] = 700; fy[2] = 800; fx[3] = 200; fy[3] = 700;
  var i = 0;
  while (i < 4) {
    drive(atan2(fy[i] - loc_y(), fx[i] - loc_x()), 100);
    if (abs(fx[i] - loc_x()) + abs(fy[i] - loc_y()) < 20) { i++; }
    yield();
  }
  drive(0, 0);
}`,
  radar: "var dir = 0; fn main() { loop { var d = scan(dir, 10); if (d > 0) { print(\"distance\", d); } dir = (dir + 20) % 360; } }",
  where: "var dir = 0; fn main() { loop { var d = scan(dir, 1); if (d > 0) { mark(loc_x() + d * cos(dir) / SCALE, loc_y() + d * sin(dir) / SCALE); } dir += 2; } }",
  throw: "var dir = 0; fn main() { loop { var d = scan(dir, 10); if (d > 0) { throw(dir, d); } else { dir = (dir + 20) % 360; } } }",
  aim: "var dir = 0; fn main() { loop { var d = scan(dir, 1); if (d > 0) { throw(dir, d); } else { dir = (dir + 2) % 360; } } }",
  moving: "var dir = 0; fn main() { loop { var d = scan(dir, 10); if (d > 0) { for (var a = dir - 8; a <= dir + 8; a += 4) { var r = scan(a, 2); if (r > 0) { throw(a, r); dir = a; if (r > 200) { drive(a, 50); } else { drive(a, 0); } break; } } } else { dir = (dir + 20) % 360; } } }",
  lead: sample("tracker"),
  "slow-cpu": `var dir = 0;
fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      for (var a = dir - 8; a <= dir + 8; a += 4) {
        var r = scan(a, 2);
        if (r > 0) {
          throw(a, r);
          dir = a;
          if (r > 200) { drive(dir, 50); } else { drive(dir, 0); }
          break;
        }
      }
    } else {
      dir += 20;
    }
  }
}`,
  goggles: "fn main() { loop { var sum = 0; for (var k = 0; k < 16; k++) { sum += scan(45, 0); } throw(45, sum / 16); } }",
  dodge: sample("wanderer"),
  duel: sample("wanderer"),
  melee: sample("tracker"),
};

function build(src: string, m: Mission): Program {
  const r = compile(src, missionRules(m));
  assert.ok(r.ok, m.id + ": " + JSON.stringify(r.diagnostics));
  return r.program!;
}

function attempt(m: Mission, src: string, seed: number): boolean {
  const rep = playMission(m, [{ name: "me", program: build(src, m) }, ...missionOpponents(m, "it", sample)], seed);
  return m.check(rep);
}

test("missions are grouped in order", () => {
  const order = MISSIONS.map((m) => GROUPS.indexOf(m.group));
  assert.ok(order.every((g, i) => g >= 0 && (i === 0 || g >= order[i - 1])), String(order));
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
});

for (const m of MISSIONS) {
  test(`mission ${m.id}`, () => {
    for (const lang of ["it", "en"] as const) {
      if (m.starter[lang]) {
        const r = compile(m.starter[lang], missionRules(m));
        assert.ok(r.ok, `${m.id} (${lang}): the starter code does not compile`);
      }
      assert.ok(m.title[lang] && m.intro[lang] && m.goal[lang], `${m.id}: texts missing in ${lang}`);
      for (const h of m.hints) assert.ok(h[lang], `${m.id}: hint missing in ${lang}`);
    }
    const seeds = m.randomSeed ? [1, 2, 3, 4, 5, 6, 7, 8] : [1];
    for (const lang of ["it", "en"] as const)
      if (m.starter[lang]) assert.ok(!seeds.some((s) => attempt(m, m.starter[lang], s)), `${m.id} (${lang}): the starter code already solves the mission`);
    assert.ok(seeds.some((s) => attempt(m, SOLUTIONS[m.id], s)), `${m.id}: the reference solution does not work`);
  });
}
