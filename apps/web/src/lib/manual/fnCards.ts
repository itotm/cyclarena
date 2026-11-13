// The function cards of the manual: which functions each card explains, an
// example in both languages and the diagram that shows it.

import type { Lang } from "@paintarena/engine";
import type { FnGroup } from "../builtinDocs.ts";

type Text = Record<Lang, string>;

export type DiagramId = "drive" | "drive_to" | "loc" | "scan" | "throw" | "throw_at" | "dirdist" | "point" | "atan2" | "trig_point" | "sincos";

export interface FnCard {
  /** Anchor in the manual (#manual/fn-<id>). */
  id: string;
  group: FnGroup;
  /** One card can explain closely related functions (loc_x and loc_y). */
  names: string[];
  example: Text;
  diagram?: DiagramId;
  /** Diagram shown for the advanced reader too (with the trigonometry). */
  extra?: DiagramId;
}

export const FN_CARDS: FnCard[] = [
  {
    id: "drive", group: "move", names: ["drive"], diagram: "drive",
    example: {
      it: `drive(90, 100);              // verso nord a tutta velocità
while (loc_y() < 800) {
  yield();
}
drive(90, 0);                // frena: si ferma circa 30 m dopo`,
      en: `drive(90, 100);              // north at full speed
while (loc_y() < 800) {
  yield();
}
drive(90, 0);                // brake: it stops about 30 m later`,
    },
  },
  {
    id: "drive_to", group: "move", names: ["drive_to"], diagram: "drive_to",
    example: {
      it: `drive_to(750, 600, 100);     // parte verso il punto (750, 600)
while (dist_to(750, 600) > 40) {
  yield();
}
drive_to(750, 600, 0);       // vicino: frena`,
      en: `drive_to(750, 600, 100);     // heads for the point (750, 600)
while (dist_to(750, 600) > 40) {
  yield();
}
drive_to(750, 600, 0);       // close: brake`,
    },
  },
  {
    id: "speed", group: "move", names: ["speed", "heading"],
    example: {
      it: `if (speed() == 0) {
  drive(heading() + 180, 50);   // fermo contro un muro? torna indietro
}`,
      en: `if (speed() == 0) {
  drive(heading() + 180, 50);   // stuck against a wall? go back
}`,
    },
  },
  {
    id: "loc", group: "move", names: ["loc_x", "loc_y"],
    example: {
      it: `if (loc_x() > ARENA - 50) {
  drive(180, 50);   // vicino al muro di destra: torna a sinistra
}`,
      en: `if (loc_x() > ARENA - 50) {
  drive(180, 50);   // near the right wall: go back left
}`,
    },
  },
  {
    id: "scan", group: "radar", names: ["scan"], diagram: "scan",
    example: {
      it: `var d = scan(dir, 10);
if (d > 0) {
  print("visto a", d, "metri");
} else {
  dir += 20;        // nessuno: gira il radar
}`,
      en: `var d = scan(dir, 10);
if (d > 0) {
  print("seen at", d, "metres");
} else {
  dir += 20;        // nobody: turn the radar
}`,
    },
  },
  {
    id: "throw", group: "throw", names: ["throw"], diagram: "throw",
    example: {
      it: `var d = scan(dir, 2);
if (d > 40 && d <= MAX_RANGE) {   // troppo vicino ci si colora da soli
  throw(dir, d);
}`,
      en: `var d = scan(dir, 2);
if (d > 40 && d <= MAX_RANGE) {   // too close you'd paint yourself
  throw(dir, d);
}`,
    },
  },
  {
    id: "throw_at", group: "throw", names: ["throw_at"], diagram: "throw_at",
    example: {
      it: `throw_at(600, 700);          // scoppia nel punto (600, 700)`,
      en: `throw_at(600, 700);          // bursts at the point (600, 700)`,
    },
  },
  {
    id: "painted", group: "throw", names: ["painted"],
    example: {
      it: `if (painted() > 50) {
  drive(rand(360), 100);   // colpito troppe volte: scappa
}`,
      en: `if (painted() > 50) {
  drive(rand(360), 100);   // hit too often: run away
}`,
    },
  },
  {
    id: "dir_to", group: "coords", names: ["dir_to", "dist_to"], diagram: "dirdist",
    example: {
      it: `if (dist_to(500, 500) > 100) {
  drive(dir_to(500, 500), 60);   // torna verso il centro
}`,
      en: `if (dist_to(500, 500) > 100) {
  drive(dir_to(500, 500), 60);   // head back to the centre
}`,
    },
  },
  {
    id: "point", group: "coords", names: ["point_x", "point_y"], diagram: "point",
    example: {
      it: `var d = scan(dir, 1);
if (d > 0) {
  var x = point_x(dir, d);   // dove si trova il robot visto
  var y = point_y(dir, d);
  mark(x, y);
}`,
      en: `var d = scan(dir, 1);
if (d > 0) {
  var x = point_x(dir, d);   // where the robot seen is
  var y = point_y(dir, d);
  mark(x, y);
}`,
    },
  },
  {
    id: "atan2", group: "trig", names: ["atan2"], diagram: "atan2",
    example: {
      it: `var dx = 750 - loc_x();
var dy = 600 - loc_y();
drive(atan2(dy, dx), 100);    // come drive_to(750, 600, 100)`,
      en: `var dx = 750 - loc_x();
var dy = 600 - loc_y();
drive(atan2(dy, dx), 100);    // like drive_to(750, 600, 100)`,
    },
  },
  {
    id: "sincos", group: "trig", names: ["sin", "cos"], diagram: "sincos", extra: "trig_point",
    example: {
      it: `var x = loc_x() + d * cos(dir) / SCALE;   // come point_x(dir, d)
var y = loc_y() + d * sin(dir) / SCALE;   // come point_y(dir, d)`,
      en: `var x = loc_x() + d * cos(dir) / SCALE;   // like point_x(dir, d)
var y = loc_y() + d * sin(dir) / SCALE;   // like point_y(dir, d)`,
    },
  },
];
