// The learning path: short missions, each teaching a single thing, in four
// groups. This module depends on neither Vite nor the DOM, so the tests can
// check that every mission is solvable.

import { compile, recordMatch, RULES_V0, type Entrant, type Lang, type Match, type Replay, type Rules } from "@paintarena/engine";

export type Text = Record<Lang, string>;

export interface Opponent {
  name: Text;
  /** Robot source, or the id of a sample robot. */
  source?: string;
  sample?: string;
}

export type MissionGroup = "move" | "see" | "throw" | "play";

/**
 * Learning path: "basic" for those who have not studied trigonometry yet (it
 * uses dir_to, point_x, drive_to…), "advanced" with atan2, sin and cos.
 */
export type LearnPath = "basic" | "advanced";

/** The texts of a mission that can change with the path. */
export interface MissionTexts {
  title: Text;
  /** Explanation: paragraphs separated by a blank line; `code` in backticks. */
  intro: Text;
  goal: Text;
  hints: Text[];
  starter: Text;
  /** System functions that may not be used (the mission teaches what they do). */
  forbid?: string[];
}

export interface Mission extends MissionTexts {
  id: string;
  group: MissionGroup;
  /** Texts of the basic path, where they differ. */
  basic?: Partial<MissionTexts>;
  /** Mission shown only in one path. */
  only?: LearnPath;
  opponents: Opponent[];
  positions?: ({ x: number; y: number } | null)[];
  /** Starting paint of each robot. */
  paint?: number[];
  rules?: Partial<Rules>;
  /** Zones to draw in the arena (flags). */
  zones?: { x: number; y: number; r: number }[];
  /** If true each attempt uses a different seed; otherwise the seed is fixed. */
  randomSeed?: boolean;
  /** Makes a fresh test that stops the match as soon as the mission is accomplished. */
  until?: () => (m: Match) => boolean;
  check: (rep: Replay) => boolean;
}

export const GROUPS: MissionGroup[] = ["move", "see", "throw", "play"];

const TARGET: Text = { it: "Bersaglio", en: "Target" };

const STILL = `// Target: stands still and does nothing.
fn main() {
  loop { yield(); }
}`;

const SHUTTLE = `// Shuttle: goes back and forth along a line.
fn main() {
  loop {
    drive(0, 50);
    while (loc_x() < 850) { yield(); }
    drive(180, 50);
    while (loc_x() > 150) { yield(); }
  }
}`;

const RUNNER = `// Runner: runs up and down at full speed.
fn main() {
  loop {
    drive(90, 100);
    while (loc_y() < 880) { yield(); }
    drive(270, 100);
    while (loc_y() > 120) { yield(); }
  }
}`;

const FLAG = { x: 750, y: 600, r: 30 };
const STOP = { x: 650, y: 500, r: 15 };
const TOUR = [{ x: 300, y: 200, r: 30 }, { x: 800, y: 300, r: 30 }, { x: 700, y: 800, r: 30 }, { x: 200, y: 700, r: 30 }];
const HIDDEN = { x: 720, y: 640 };
const S = RULES_V0.splash;
const splashIt = S.map((l) => `${l.paint}% entro ${l.range} metri`).join(", ");
const splashEn = S.map((l) => `${l.paint}% within ${l.range} metres`).join(", ");

const WHERE_STARTER: Text = {
  it: `// Missione: segna con mark() dove si trova il bersaglio.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      print("visto a", d, "metri in direzione", dir);
      // calcola x e y del bersaglio e segnale con mark(x, y)
    }
    dir = (dir + 20) % 360;
  }
}
`,
  en: `// Mission: mark() where the target is.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      print("seen at", d, "metres, direction", dir);
      // work out the x and y of the target and mark(x, y) them
    }
    dir = (dir + 20) % 360;
  }
}
`,
};

const WHERE_HINTS: Text[] = [
  { it: "Con un radar largo ±10 gradi la direzione è troppo imprecisa: a 570 metri l'errore può superare i 90 metri.", en: "With a ±10 degree radar the direction is too rough: at 570 metres the error can be over 90 metres." },
  { it: "Usa scan(dir, 1) e gira il radar di 2 gradi alla volta: la direzione sarà giusta entro un grado.", en: "Use scan(dir, 1) and turn the radar 2 degrees at a time: the direction will be right within one degree." },
  { it: "Quando d > 0: mark(loc_x() + d * cos(dir) / SCALE, loc_y() + d * sin(dir) / SCALE);", en: "When d > 0: mark(loc_x() + d * cos(dir) / SCALE, loc_y() + d * sin(dir) / SCALE);" },
];

type Z = { x: number; y: number; r: number };
const near = (rx: number, ry: number, z: Z) => Math.hypot(rx - z.x, ry - z.y) <= z.r;
const won = (rep: Replay) => rep.result.winner === 0;
const last = (rep: Replay) => rep.frames[rep.frames.length - 1];

/** How many flags of the tour have been reached in order, frame after frame. */
function tourProgress(at: (k: number) => { x: number; y: number } | null): number {
  let next = 0;
  for (let k = 0; next < TOUR.length; k++) {
    const p = at(k);
    if (!p) break;
    if (near(p.x, p.y, TOUR[next])) next++;
  }
  return next;
}

export const MISSIONS: Mission[] = [
  // --- moving ---
  {
    id: "move",
    group: "move",
    title: { it: "Raggiungi la bandiera", en: "Reach the flag" },
    intro: {
      it: "Un robot si muove con `drive(direzione, velocità)`. La direzione è in gradi: 0 è est (destra), 90 è nord (su), 180 ovest, 270 sud. La velocità va da 0 a 100.\n\nIl robot resta in movimento finché non gli dai un altro comando, anche quando il programma è finito.\n\nPer sapere in che direzione si trova un punto c'è `atan2(dy, dx)`: dy e dx sono quanto manca per arrivarci, in verticale e in orizzontale.",
      en: "A robot moves with `drive(direction, speed)`. Direction is in degrees: 0 is east (right), 90 is north (up), 180 west, 270 south. Speed goes from 0 to 100.\n\nThe robot keeps moving until you give it another command, even after the program has ended.\n\nTo find the direction of a point use `atan2(dy, dx)`: dy and dx are how far it is, vertically and horizontally.",
    },
    goal: { it: "Porta il robot sulla bandiera (x = 750, y = 600) entro 500 tick.", en: "Get the robot onto the flag (x = 750, y = 600) within 500 ticks." },
    hints: [
      { it: "Il robot parte da (150, 150): la bandiera è in alto a destra, quindi la direzione è tra 0 e 90 gradi.", en: "The robot starts at (150, 150): the flag is up and to the right, so the direction is between 0 and 90 degrees." },
      { it: "dx = 750 − loc_x() e dy = 600 − loc_y(); la direzione è atan2(dy, dx).", en: "dx = 750 − loc_x() and dy = 600 − loc_y(); the direction is atan2(dy, dx)." },
      { it: "Soluzione: drive(atan2(600 - loc_y(), 750 - loc_x()), 100);", en: "Solution: drive(atan2(600 - loc_y(), 750 - loc_x()), 100);" },
    ],
    starter: {
      it: `// Missione: raggiungi la bandiera in x = 750, y = 600.

fn main() {
  drive(0, 100);   // va verso est... ma la bandiera non è a est!
}
`,
      en: `// Mission: reach the flag at x = 750, y = 600.

fn main() {
  drive(0, 100);   // heads east... but the flag is not east!
}
`,
    },
    basic: {
      intro: {
        it: "Un robot si muove con `drive(direzione, velocità)`. La direzione è in gradi: 0 è est (destra), 90 è nord (su), 180 ovest, 270 sud. La velocità va da 0 a 100.\n\nIl robot resta in movimento finché non gli dai un altro comando, anche quando il programma è finito.\n\nL'arena è come un foglio a quadretti: ogni punto ha una x (quanto è a destra) e una y (quanto è in alto), in metri, da 0 a 1000. Per andare verso un punto c'è `drive_to(x, y, velocità)`: la direzione giusta la calcola lei.",
        en: "A robot moves with `drive(direction, speed)`. Direction is in degrees: 0 is east (right), 90 is north (up), 180 west, 270 south. Speed goes from 0 to 100.\n\nThe robot keeps moving until you give it another command, even after the program has ended.\n\nThe arena is like squared paper: every point has an x (how far right) and a y (how far up), in metres, from 0 to 1000. To head for a point use `drive_to(x, y, speed)`: it works out the right direction by itself.",
      },
      hints: [
        { it: "Il robot parte da (150, 150): la bandiera è in alto a destra, in (750, 600).", en: "The robot starts at (150, 150): the flag is up and to the right, at (750, 600)." },
        { it: "Al posto di drive(0, 100) usa drive_to con le coordinate della bandiera.", en: "Instead of drive(0, 100) use drive_to with the coordinates of the flag." },
        { it: "Soluzione: drive_to(750, 600, 100);", en: "Solution: drive_to(750, 600, 100);" },
      ],
    },
    opponents: [],
    positions: [{ x: 150, y: 150 }],
    rules: { maxTicks: 500 },
    zones: [FLAG],
    until: () => (m) => near(m.robots[0].x / 1000, m.robots[0].y / 1000, FLAG),
    check: (rep) => rep.frames.some((f) => near(f.robots[0].x, f.robots[0].y, FLAG)),
  },
  {
    id: "stop",
    group: "move",
    title: { it: "Fermati sulla bandiera", en: "Stop on the flag" },
    intro: {
      it: "Un robot non si ferma di colpo: accelera e frena di 10 punti di velocità a ogni tick. A tutta velocità (100%) fa 7 metri per tick, e per fermarsi gli servono 10 tick, in cui percorre ancora circa 31 metri.\n\n`speed()` dice la velocità attuale e `loc_x()` dove si trova. Per fermarsi in un punto preciso bisogna cominciare a frenare prima di arrivarci.\n\nIn un ciclo che aspetta, `yield()` chiude il tick senza sprecare cicli.",
      en: "A robot doesn't stop dead: it speeds up and slows down by 10 points of speed every tick. At full speed (100%) it covers 7 metres per tick, and it needs 10 ticks to stop, while still covering about 31 metres.\n\n`speed()` gives the current speed and `loc_x()` where it is. To stop at a precise point you have to start braking before you get there.\n\nIn a loop that waits, `yield()` ends the tick without wasting cycles.",
    },
    goal: { it: "Fermati (velocità 0) dentro la bandiera in x = 650, y = 500, entro 400 tick.", en: "Stop (speed 0) inside the flag at x = 650, y = 500, within 400 ticks." },
    hints: [
      { it: "La bandiera è larga 15 metri attorno al centro: se freni quando ci sei sopra, la superi.", en: "The flag is 15 metres around its centre: if you brake when you are on top of it, you overshoot." },
      { it: "Aspetta finché mancano circa 35 metri: while (650 - loc_x() > 35) { yield(); } e poi drive(0, 0);", en: "Wait until about 35 metres are left: while (650 - loc_x() > 35) { yield(); } and then drive(0, 0);" },
    ],
    starter: {
      it: `// Missione: fermati sulla bandiera in x = 650, y = 500.

fn main() {
  drive(0, 100);
  // aspetta di arrivare alla bandiera...
  while (loc_x() < 650) {
    yield();
  }
  drive(0, 0);   // ...e frena. Ma ti fermi in tempo?
  loop {
    yield();
  }
}
`,
      en: `// Mission: stop on the flag at x = 650, y = 500.

fn main() {
  drive(0, 100);
  // wait until you reach the flag...
  while (loc_x() < 650) {
    yield();
  }
  drive(0, 0);   // ...and brake. But do you stop in time?
  loop {
    yield();
  }
}
`,
    },
    opponents: [],
    positions: [{ x: 150, y: 500 }],
    rules: { maxTicks: 400 },
    zones: [STOP],
    until: () => (m) => m.robots[0].speed === 0 && near(m.robots[0].x / 1000, m.robots[0].y / 1000, STOP),
    check: (rep) => rep.frames.some((f) => f.robots[0].speed === 0 && near(f.robots[0].x, f.robots[0].y, STOP)),
  },
  {
    id: "tour",
    group: "move",
    title: { it: "Giro delle bandiere", en: "Flag tour" },
    intro: {
      it: "Quattro bandiere da toccare in ordine. Le loro coordinate stanno bene in due array: `var bx[4];` crea quattro variabili, da `bx[0]` a `bx[3]`, che partono tutte da zero.\n\nUna variabile `i` dice a quale bandiera stai andando: quando ci arrivi, `i++` passa alla successiva.\n\nPer girare un robot deve andare al 50% o meno: se gli chiedi una nuova direzione mentre va più veloce, prima rallenta da solo e poi gira.",
      en: "Four flags to touch in order. Their coordinates fit nicely in two arrays: `var fx[4];` creates four variables, from `fx[0]` to `fx[3]`, all starting at zero.\n\nA variable `i` says which flag you are heading for: when you reach it, `i++` moves on to the next one.\n\nTo turn, a robot must be at 50% speed or less: if you ask for a new direction while it goes faster, it first slows down by itself and then turns.",
    },
    goal: { it: "Tocca le quattro bandiere nell'ordine, entro 1000 tick.", en: "Touch the four flags in order, within 1000 ticks." },
    hints: [
      { it: "Le bandiere sono in (300, 200), (800, 300), (700, 800) e (200, 700).", en: "The flags are at (300, 200), (800, 300), (700, 800) and (200, 700)." },
      { it: "Ricalcola la direzione a ogni tick, dentro un loop: drive(atan2(by[i] - loc_y(), bx[i] - loc_x()), 100);", en: "Work out the direction again every tick, inside a loop: drive(atan2(fy[i] - loc_y(), fx[i] - loc_x()), 100);" },
      { it: "Sei arrivato quando abs(bx[i] - loc_x()) + abs(by[i] - loc_y()) < 20: allora i++ (e dopo l'ultima, fermati).", en: "You have arrived when abs(fx[i] - loc_x()) + abs(fy[i] - loc_y()) < 20: then i++ (and after the last one, stop)." },
    ],
    starter: {
      it: `// Missione: tocca le quattro bandiere nell'ordine.

var bx[4];   // coordinate delle bandiere
var by[4];

fn main() {
  bx[0] = 300;
  by[0] = 200;
  // completa le altre tre: (800, 300), (700, 800), (200, 700)

  var i = 0;   // la bandiera a cui stiamo andando
  drive(atan2(by[i] - loc_y(), bx[i] - loc_x()), 100);
  loop {
    yield();
  }
}
`,
      en: `// Mission: touch the four flags in order.

var fx[4];   // coordinates of the flags
var fy[4];

fn main() {
  fx[0] = 300;
  fy[0] = 200;
  // fill in the other three: (800, 300), (700, 800), (200, 700)

  var i = 0;   // the flag we are heading for
  drive(atan2(fy[i] - loc_y(), fx[i] - loc_x()), 100);
  loop {
    yield();
  }
}
`,
    },
    basic: {
      hints: [
        { it: "Le bandiere sono in (300, 200), (800, 300), (700, 800) e (200, 700).", en: "The flags are at (300, 200), (800, 300), (700, 800) and (200, 700)." },
        { it: "Ricalcola la direzione a ogni tick, dentro un loop: drive_to(bx[i], by[i], 100);", en: "Work out the direction again every tick, inside a loop: drive_to(fx[i], fy[i], 100);" },
        { it: "Sei arrivato quando dist_to(bx[i], by[i]) < 20: allora i++ (e dopo l'ultima, fermati).", en: "You have arrived when dist_to(fx[i], fy[i]) < 20: then i++ (and after the last one, stop)." },
      ],
      starter: {
        it: `// Missione: tocca le quattro bandiere nell'ordine.

var bx[4];   // coordinate delle bandiere
var by[4];

fn main() {
  bx[0] = 300;
  by[0] = 200;
  // completa le altre tre: (800, 300), (700, 800), (200, 700)

  var i = 0;   // la bandiera a cui stiamo andando
  drive_to(bx[i], by[i], 100);
  loop {
    yield();
  }
}
`,
        en: `// Mission: touch the four flags in order.

var fx[4];   // coordinates of the flags
var fy[4];

fn main() {
  fx[0] = 300;
  fy[0] = 200;
  // fill in the other three: (800, 300), (700, 800), (200, 700)

  var i = 0;   // the flag we are heading for
  drive_to(fx[i], fy[i], 100);
  loop {
    yield();
  }
}
`,
      },
    },
    opponents: [],
    positions: [{ x: 100, y: 100 }],
    rules: { maxTicks: 1000 },
    zones: TOUR,
    until: () => {
      let next = 0;
      return (m) => {
        if (next < TOUR.length && near(m.robots[0].x / 1000, m.robots[0].y / 1000, TOUR[next])) next++;
        return next === TOUR.length;
      };
    },
    check: (rep) => tourProgress((k) => rep.frames[k]?.robots[0] ?? null) === TOUR.length,
  },

  // --- seeing ---
  {
    id: "radar",
    group: "see",
    title: { it: "Accendi il radar", en: "Turn on the radar" },
    intro: {
      it: "I robot non vedono l'arena: hanno solo un radar. `scan(direzione, ampiezza)` guarda in un cono largo ± ampiezza gradi (da 0 a 10) e restituisce la distanza in metri del robot più vicino, oppure 0 se non c'è nessuno.\n\nPer cercare tutto intorno si fa girare il radar un po' alla volta, dentro un `loop`.\n\n`print(...)` scrive nella console testi e numeri: è il modo più semplice per capire cosa sta facendo il programma.",
      en: "Robots can't see the arena: they only have a radar. `scan(direction, width)` looks in a cone ± width degrees wide (0 to 10) and returns the distance in metres of the nearest robot, or 0 if there is none.\n\nTo search all around, turn the radar a bit at a time inside a `loop`.\n\n`print(...)` writes text and numbers to the console: the simplest way to understand what the program is doing.",
    },
    goal: { it: "Trova il bersaglio e scrivi con print() la sua distanza, entro 300 tick.", en: "Find the target and print() its distance, within 300 ticks." },
    hints: [
      { it: "Dopo var d = scan(dir, 10); controlla se d è maggiore di zero.", en: "After var d = scan(dir, 10); check whether d is greater than zero." },
      { it: "if (d > 0) { print(\"distanza\", d); }", en: "if (d > 0) { print(\"distance\", d); }" },
    ],
    starter: {
      it: `// Missione: trova il bersaglio e scrivi la sua distanza.

var dir = 0;   // dove guarda il radar

fn main() {
  loop {
    var d = scan(dir, 10);
    // se d è maggiore di zero hai trovato il bersaglio: scrivilo con print!
    dir = (dir + 20) % 360;   // gira il radar di 20 gradi
  }
}
`,
      en: `// Mission: find the target and print its distance.

var dir = 0;   // where the radar is looking

fn main() {
  loop {
    var d = scan(dir, 10);
    // if d is greater than zero you found the target: print it!
    dir = (dir + 20) % 360;   // turn the radar by 20 degrees
  }
}
`,
    },
    opponents: [{ name: TARGET, source: STILL }],
    positions: [{ x: 500, y: 500 }, { x: 780, y: 300 }],
    rules: { maxTicks: 300 },
    until: () => (m) => m.events.some((e) => e.t === "print" && e.robot === 0 && printsDistance(e.text, m.robots[0], m.robots[1])),
    check: (rep) => rep.frames.some((f) => f.events.some((e) => e.t === "print" && e.robot === 0 &&
      printsDistance(e.text, { x: f.robots[0].x * 1000, y: f.robots[0].y * 1000 }, { x: f.robots[1].x * 1000, y: f.robots[1].y * 1000 }))),
  },
  {
    id: "where",
    group: "see",
    title: { it: "Dov'è?", en: "Where is it?" },
    intro: {
      it: "Il radar dà una direzione e una distanza. Per avere le coordinate x, y del robot che hai visto serve un po' di trigonometria:\n\n`x = loc_x() + d * cos(dir) / SCALE` e `y = loc_y() + d * sin(dir) / SCALE`\n\n`cos` e `sin` restituiscono numeri interi moltiplicati per SCALE (10000), perché il linguaggio non ha numeri con la virgola: per questo si divide per SCALE.\n\n`mark(x, y)` disegna una crocetta nell'arena: serve a vedere dove il robot «pensa» che sia qualcosa.",
      en: "The radar gives a direction and a distance. To get the x, y coordinates of the robot you saw you need a little trigonometry:\n\n`x = loc_x() + d * cos(dir) / SCALE` and `y = loc_y() + d * sin(dir) / SCALE`\n\n`cos` and `sin` return integers multiplied by SCALE (10000), because the language has no decimal numbers: that's why you divide by SCALE.\n\n`mark(x, y)` draws a small cross in the arena: it shows where the robot “thinks” something is.",
    },
    goal: { it: "Metti un mark() a meno di 15 metri dal bersaglio, entro 300 tick.", en: "Put a mark() less than 15 metres from the target, within 300 ticks." },
    hints: WHERE_HINTS,
    starter: WHERE_STARTER,
    forbid: ["point_x", "point_y"],
    basic: {
      intro: {
        it: "Il radar dà una direzione e una distanza: «c'è un robot a 570 metri, in direzione 40 gradi». Per sapere le coordinate x, y di quel punto ci sono `point_x(direzione, distanza)` e `point_y(direzione, distanza)`: partono dalla posizione del tuo robot e fanno quei metri in quella direzione.\n\n`mark(x, y)` disegna una crocetta nell'arena: serve a vedere dove il robot «pensa» che sia qualcosa.",
        en: "The radar gives a direction and a distance: “there is a robot 570 metres away, direction 40 degrees”. To get the x, y coordinates of that point use `point_x(direction, distance)` and `point_y(direction, distance)`: they start from your robot's position and go that many metres in that direction.\n\n`mark(x, y)` draws a small cross in the arena: it shows where the robot “thinks” something is.",
      },
      hints: [
        WHERE_HINTS[0],
        WHERE_HINTS[1],
        { it: "Quando d > 0: mark(point_x(dir, d), point_y(dir, d));", en: "When d > 0: mark(point_x(dir, d), point_y(dir, d));" },
      ],
      forbid: [],
    },
    opponents: [{ name: TARGET, source: STILL }],
    positions: [{ x: 300, y: 250 }, HIDDEN],
    rules: { maxTicks: 300 },
    until: () => (m) => m.events.some((e) => e.t === "mark" && e.robot === 0 && Math.hypot(e.x - HIDDEN.x, e.y - HIDDEN.y) < 15),
    check: (rep) => rep.frames.some((f) => f.events.some((e) => e.t === "mark" && e.robot === 0 && Math.hypot(e.x - HIDDEN.x, e.y - HIDDEN.y) < 15)),
  },

  {
    id: "trig",
    group: "see",
    only: "basic",
    title: { it: "Dietro le quinte", en: "Behind the scenes" },
    intro: {
      it: "Una missione in più, per quando a scuola arriverà la trigonometria (o per i curiosi): come fanno `point_x` e `point_y` a trovare il punto?\n\nImmagina un triangolo rettangolo: il lato lungo è la distanza d, i due lati corti sono quanto il punto è spostato in orizzontale e in verticale. Il coseno della direzione dice quanta parte di d va in orizzontale, il seno quanta in verticale:\n\n`x = loc_x() + d * cos(dir) / SCALE` e `y = loc_y() + d * sin(dir) / SCALE`\n\n`cos` e `sin` restituiscono numeri interi moltiplicati per SCALE (10000), perché il linguaggio non ha numeri con la virgola: per questo si divide per SCALE.\n\nIl contrario, da dx e dy alla direzione, lo fa `atan2(dy, dx)`: è quello che c'è dentro `dir_to`.",
      en: "A bonus mission, for when trigonometry comes up at school (or for the curious): how do `point_x` and `point_y` find the point?\n\nPicture a right triangle: the long side is the distance d, the two short sides are how far the point is moved horizontally and vertically. The cosine of the direction says how much of d goes horizontally, the sine how much vertically:\n\n`x = loc_x() + d * cos(dir) / SCALE` and `y = loc_y() + d * sin(dir) / SCALE`\n\n`cos` and `sin` return integers multiplied by SCALE (10000), because the language has no decimal numbers: that's why you divide by SCALE.\n\nThe other way round, from dx and dy to the direction, is `atan2(dy, dx)`: it is what's inside `dir_to`.",
    },
    goal: { it: "Come in «Dov'è?», metti un mark() a meno di 15 metri dal bersaglio entro 300 tick, ma senza point_x e point_y: usa cos e sin.", en: "As in “Where is it?”, put a mark() less than 15 metres from the target within 300 ticks, but without point_x and point_y: use cos and sin." },
    hints: WHERE_HINTS,
    starter: WHERE_STARTER,
    forbid: ["point_x", "point_y"],
    opponents: [{ name: TARGET, source: STILL }],
    positions: [{ x: 300, y: 250 }, HIDDEN],
    rules: { maxTicks: 300 },
    until: () => (m) => m.events.some((e) => e.t === "mark" && e.robot === 0 && Math.hypot(e.x - HIDDEN.x, e.y - HIDDEN.y) < 15),
    check: (rep) => rep.frames.some((f) => f.events.some((e) => e.t === "mark" && e.robot === 0 && Math.hypot(e.x - HIDDEN.x, e.y - HIDDEN.y) < 15)),
  },

  // --- throwing ---
  {
    id: "throw",
    group: "throw",
    title: { it: "Lancia!", en: "Throw!" },
    intro: {
      it: "`throw(direzione, distanza)` lancia un gavettone di vernice che vola nella direzione data e scoppia alla distanza indicata, al massimo 700 metri.\n\nLo schizzo colora chi è vicino: " + splashIt + ". Un robot colorato al 100% è fuori gioco. Dopo ogni lancio servono " + RULES_V0.reloadTicks + " tick per ricaricare.\n\nAttenzione: il radar con ampiezza 10 dice solo che il bersaglio è entro ±10 gradi. Più il bersaglio è lontano, più l'errore conta.",
      en: "`throw(direction, distance)` throws a paint balloon that flies in the given direction and bursts at the given distance, at most 700 metres.\n\nThe splash paints whoever is near: " + splashEn + ". A robot that is 100% painted is out of the game. After each throw it takes " + RULES_V0.reloadTicks + " ticks to reload.\n\nCareful: a radar width of 10 only tells you the target is within ±10 degrees. The farther the target, the more that error matters.",
    },
    goal: { it: "Colora del tutto il bersaglio fermo entro 2000 tick.", en: "Paint the still target completely within 2000 ticks." },
    hints: [
      { it: "Quando d > 0 chiama throw(dir, d).", en: "When d > 0 call throw(dir, d)." },
      { it: "Quando hai trovato il bersaglio non girare il radar: al giro dopo guarderai ancora lì e potrai lanciare di nuovo.", en: "When you've found the target don't turn the radar: next time round you'll look there again and can throw again." },
      { it: "Metti dir = (dir + 20) % 360; dentro un else, così gira solo se non ha visto niente.", en: "Put dir = (dir + 20) % 360; inside an else, so it turns only when it sees nothing." },
    ],
    starter: {
      it: `// Missione: colora il bersaglio.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      print("bersaglio a", d, "metri in direzione", dir);
      // lancia qui!
    }
    dir = (dir + 20) % 360;
  }
}
`,
      en: `// Mission: paint the target.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      print("target at", d, "metres, direction", dir);
      // throw here!
    }
    dir = (dir + 20) % 360;
  }
}
`,
    },
    opponents: [{ name: TARGET, source: STILL }],
    positions: [{ x: 200, y: 700 }, { x: 550, y: 400 }],
    rules: { maxTicks: 2000 },
    check: won,
  },
  {
    id: "aim",
    group: "throw",
    title: { it: "Mira precisa", en: "Precise aim" },
    intro: {
      it: "Ora il bersaglio è più lontano: con un radar largo ±10 gradi i gavettoni cadono troppo lontano per colorarlo.\n\nUn radar stretto è più preciso e costa anche meno cicli (8 + 2 × ampiezza), ma copre meno spazio: per guardare tutto intorno servono più scan.\n\nUna buona strategia: cerca con il radar largo, poi, quando vedi qualcosa, stringi il fascio per trovare la direzione esatta.",
      en: "Now the target is farther away: with a ±10 degree radar the balloons land too far away to paint it.\n\nA narrow radar is more precise and also costs fewer cycles (8 + 2 × width), but covers less space: looking all around takes more scans.\n\nA good strategy: search with a wide radar, then, when you see something, narrow the beam to find the exact direction.",
    },
    goal: { it: "Colora del tutto il bersaglio lontano entro 1500 tick.", en: "Paint the distant target completely within 1500 ticks." },
    hints: [
      { it: "Prova scan(dir, 1) con passi di 2 gradi: guarda in ±1 grado, quindi due scan di fila coprono 2 gradi.", en: "Try scan(dir, 1) with steps of 2 degrees: it looks ±1 degree, so consecutive scans cover 2 degrees." },
      { it: "Oppure: quando scan(dir, 10) vede qualcosa, prova scan(a, 2) per a da dir − 8 a dir + 8 a passi di 4.", en: "Or: when scan(dir, 10) sees something, try scan(a, 2) for a from dir − 8 to dir + 8 in steps of 4." },
    ],
    starter: {
      it: `// Missione: colora il bersaglio lontano.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      throw(dir, d);
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
      en: `// Mission: paint the distant target.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      throw(dir, d);
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
    },
    opponents: [{ name: TARGET, source: STILL }],
    positions: [{ x: 100, y: 100 }, { x: 657, y: 435 }],
    rules: { maxTicks: 1500 },
    check: won,
  },
  {
    id: "moving",
    group: "throw",
    title: { it: "Bersaglio mobile", en: "Moving target" },
    intro: {
      it: "Questo bersaglio va avanti e indietro. Un gavettone ci mette un po' ad arrivare (50 metri per tick): quando scoppia, il bersaglio si è già spostato.\n\nPer colpirlo bisogna aggiornare spesso la mira, quindi il ciclo del programma deve essere veloce: ogni istruzione in meno è un'occhiata in più.\n\nGuarda nell'editor il costo di ogni riga, e dopo la partita il riquadro «Dove spende i cicli il tuo robot».",
      en: "This target moves back and forth. A balloon takes a while to arrive (50 metres per tick): when it bursts, the target has already moved.\n\nTo hit it you must update your aim often, so the program's loop must be fast: every instruction saved is one more look.\n\nCheck the cost of each line in the editor, and after the match the “Where your robot spends its cycles” box.",
    },
    goal: { it: "Colora del tutto il bersaglio mobile entro 250 tick.", en: "Paint the moving target completely within 250 ticks." },
    hints: [
      { it: "Usa la mira precisa della missione precedente.", en: "Use the precise aim from the previous mission." },
      { it: "Avvicinati: più sei vicino, meno tempo vola il gavettone. drive verso il bersaglio quando è lontano.", en: "Get closer: the nearer you are, the shorter the balloon's flight. drive towards the target when it's far." },
    ],
    starter: {
      it: `// Missione: colora il bersaglio che si muove.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      throw(dir, d);
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
      en: `// Mission: paint the moving target.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      throw(dir, d);
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
    },
    opponents: [{ name: { it: "Navetta", en: "Shuttle" }, source: SHUTTLE }],
    positions: [{ x: 500, y: 100 }, { x: 150, y: 650 }],
    rules: { maxTicks: 250 },
    check: won,
  },
  {
    id: "lead",
    group: "throw",
    title: { it: "Anticipa la mossa", en: "Lead the target" },
    intro: {
      it: "Il Corridore va su e giù a tutta velocità, 7 metri per tick, lontano da te. Un gavettone ci mette più di 10 tick ad arrivare: se lanci dove lo vedi, quando scoppia lui è già 70 metri più in là.\n\nBisogna lanciare dove sarà. Misura la sua posizione due volte, a qualche tick di distanza: la differenza divisa per il tempo è la sua velocità. Poi calcola dove sarà quando il gavettone arriva (distanza / 50 tick di volo).\n\nLa posizione si calcola come nella missione «Dov'è?», e `time()` dice il tick attuale.",
      en: "The Runner goes up and down at full speed, 7 metres per tick, far from you. A balloon takes over 10 ticks to get there: if you throw where you see it, by the time it bursts the Runner is 70 metres further on.\n\nYou have to throw where it will be. Measure its position twice, a few ticks apart: the difference divided by the time is its velocity. Then work out where it will be when the balloon arrives (distance / 50 ticks of flight).\n\nThe position is worked out as in the “Where is it?” mission, and `time()` gives the current tick.",
    },
    goal: { it: "Colora del tutto il Corridore entro 1000 tick.", en: "Paint the Runner completely within 1000 ticks." },
    hints: [
      { it: "Il Corridore si muove solo in verticale: basta stimare la sua velocità lungo y.", en: "The Runner only moves vertically: estimating its speed along y is enough." },
      { it: "Velocità in metri per tick: vy = (y2 − y1) / (t2 − t1), con almeno 5 tick tra le due misure. Punto da colpire: y + vy × (volo + tick passati dall'ultima misura).", en: "Speed in metres per tick: vy = (y2 − y1) / (t2 − t1), with at least 5 ticks between the two measurements. Point to hit: y + vy × (flight + ticks since the last measurement)." },
      { it: "Il robot di esempio Segugio fa proprio questo: leggine il codice nella modalità libera.", en: "The Tracker sample robot does exactly this: read its code in free play." },
    ],
    starter: {
      it: `// Missione: colora il Corridore lanciando dove sarà.
// Questo robot mira bene, ma lancia dove il Corridore è adesso.

var dir = 0;

// cerca la direzione precisa entro ±10 gradi con un fascio stretto
fn affina(centro) {
  for (var a = centro - 8; a <= centro + 8; a += 2) {
    if (scan(a, 1) > 0) {
      return a;
    }
  }
  return centro;
}

fn main() {
  loop {
    if (scan(dir, 10) > 0) {
      dir = affina(dir);
      var d = scan(dir, 1);
      if (d > 0) {
        throw(dir, d);
      }
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
      en: `// Mission: paint the Runner by throwing where it will be.
// This robot aims well, but throws where the Runner is now.

var dir = 0;

// looks for the precise direction within ±10 degrees using a narrow beam
fn refine(center) {
  for (var a = center - 8; a <= center + 8; a += 2) {
    if (scan(a, 1) > 0) {
      return a;
    }
  }
  return center;
}

fn main() {
  loop {
    if (scan(dir, 10) > 0) {
      dir = refine(dir);
      var d = scan(dir, 1);
      if (d > 0) {
        throw(dir, d);
      }
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
    },
    basic: {
      intro: {
        it: "Il Corridore va su e giù a tutta velocità, 7 metri per tick, lontano da te. Un gavettone ci mette più di 10 tick ad arrivare: se lanci dove lo vedi, quando scoppia lui è già 70 metri più in là.\n\nBisogna lanciare dove sarà. Misura la sua posizione due volte, a qualche tick di distanza: la differenza divisa per il tempo è la sua velocità. Poi calcola dove sarà quando il gavettone arriva (distanza / 50 tick di volo).\n\nLa posizione si trova con `point_x` e `point_y`, come nella missione «Dov'è?»; `time()` dice il tick attuale e `throw_at(x, y)` lancia proprio sul punto (x, y).",
        en: "The Runner goes up and down at full speed, 7 metres per tick, far from you. A balloon takes over 10 ticks to get there: if you throw where you see it, by the time it bursts the Runner is 70 metres further on.\n\nYou have to throw where it will be. Measure its position twice, a few ticks apart: the difference divided by the time is its velocity. Then work out where it will be when the balloon arrives (distance / 50 ticks of flight).\n\nThe position comes from `point_x` and `point_y`, as in the “Where is it?” mission; `time()` gives the current tick and `throw_at(x, y)` throws right at the point (x, y).",
      },
      hints: [
        { it: "Il Corridore si muove solo in verticale: basta stimare la sua velocità lungo y.", en: "The Runner only moves vertically: estimating its speed along y is enough." },
        { it: "Velocità in metri per tick: vy = (y2 − y1) / (t2 − t1), con almeno 5 tick tra le due misure. Poi throw_at(x, y + vy × (volo + tick passati dall'ultima misura)).", en: "Speed in metres per tick: vy = (y2 − y1) / (t2 − t1), with at least 5 ticks between the two measurements. Then throw_at(x, y + vy × (flight + ticks since the last measurement))." },
        { it: "Il robot di esempio Tiratore fa proprio questo: leggine il codice nella modalità libera.", en: "The Marksman sample robot does exactly this: read its code in free play." },
      ],
    },
    opponents: [{ name: { it: "Corridore", en: "Runner" }, source: RUNNER }],
    positions: [{ x: 120, y: 500 }, { x: 750, y: 500 }],
    rules: { maxTicks: 1000 },
    check: won,
  },

  // --- playing ---
  {
    id: "slow-cpu",
    group: "play",
    title: { it: "Processore lento", en: "Slow processor" },
    intro: {
      it: "In questa missione il tuo robot ha un processore lentissimo: solo 12 cicli per tick invece di 50. Lo stesso programma va quattro volte più piano.\n\nIl robot di partenza è quello giusto per il bersaglio mobile, ma è scritto male: fa calcoli che non servono. Guarda nell'editor quanto costa ogni riga e, dopo una partita, quali righe consumano più cicli.\n\nRegola d'oro: prima di ottimizzare, misura.",
      en: "In this mission your robot has a very slow processor: only 12 cycles per tick instead of 50. The same program runs four times slower.\n\nThe starting robot has the right strategy for the moving target, but it's badly written: it does work it doesn't need. Check the cost of each line in the editor and, after a match, which lines use the most cycles.\n\nGolden rule: measure before you optimize.",
    },
    goal: { it: "Con 12 cicli per tick, colora del tutto il bersaglio mobile entro 750 tick.", en: "With 12 cycles per tick, paint the moving target completely within 750 ticks." },
    hints: [
      { it: "scan, throw e drive accettano qualunque angolo, anche negativo o oltre 360: normalizza() non serve.", en: "scan, throw and drive accept any angle, even negative or above 360: normalize() is not needed." },
      { it: "Chiamare una tua funzione costa CALL (4) + ENTER (1) + RET (2), più gli argomenti: cerca() aggiunge solo costi, usa direttamente scan().", en: "Calling one of your functions costs CALL (4) + ENTER (1) + RET (2), plus the arguments: look() only adds cost, call scan() directly." },
      { it: "dir += 20; basta: l'angolo può crescere oltre 360 senza problemi.", en: "dir += 20; is enough: the angle can grow past 360 without problems." },
    ],
    starter: {
      it: `// Missione: processore lento (12 cicli per tick).
// Questo robot funziona, ma spreca cicli: rendilo più veloce.

var dir = 0;

// porta un angolo tra 0 e 359
fn normalizza(a) {
  return (a + 360) % 360;
}

// guarda in una direzione
fn cerca(a, ampiezza) {
  return scan(normalizza(a), ampiezza);
}

fn main() {
  loop {
    var d = cerca(dir, 10);
    if (d > 0) {
      // visto qualcosa: cerca la direzione precisa con un fascio stretto
      for (var a = dir - 8; a <= dir + 8; a += 4) {
        var r = cerca(a, 2);
        if (r > 0) {
          throw(normalizza(a), r);
          dir = normalizza(a);
          if (r > 200) { drive(dir, 50); } else { drive(dir, 0); }
          break;
        }
      }
    } else {
      dir = normalizza(dir + 20);
    }
  }
}
`,
      en: `// Mission: slow processor (12 cycles per tick).
// This robot works, but wastes cycles: make it faster.

var dir = 0;

// brings an angle between 0 and 359
fn normalize(a) {
  return (a + 360) % 360;
}

// looks in a direction
fn look(a, width) {
  return scan(normalize(a), width);
}

fn main() {
  loop {
    var d = look(dir, 10);
    if (d > 0) {
      // saw something: find the exact direction with a narrow beam
      for (var a = dir - 8; a <= dir + 8; a += 4) {
        var r = look(a, 2);
        if (r > 0) {
          throw(normalize(a), r);
          dir = normalize(a);
          if (r > 200) { drive(dir, 50); } else { drive(dir, 0); }
          break;
        }
      }
    } else {
      dir = normalize(dir + 20);
    }
  }
}
`,
    },
    opponents: [{ name: { it: "Navetta", en: "Shuttle" }, source: SHUTTLE }],
    positions: [{ x: 500, y: 250 }, { x: 150, y: 650 }],
    rules: { maxTicks: 750, cyclesPerTick: 12 },
    check: won,
  },
  {
    id: "goggles",
    group: "play",
    title: { it: "Occhiali sporchi", en: "Dirty goggles" },
    intro: {
      it: "Il tuo robot parte già colorato al 90%. Con tanta vernice addosso il radar sbaglia la distanza: fino al ±9%, cioè più di 50 metri a questa distanza. La direzione invece resta esatta.\n\nOgni lettura sbaglia a caso, un po' in più o un po' in meno: facendo la media di tante letture gli errori si compensano. Leggi la distanza 16 volte, somma, e dividi per 16: costa pochi cicli, perché scan con ampiezza 0 costa solo 8.\n\n`painted()` dice quanto è colorato il tuo robot.",
      en: "Your robot starts already 90% painted. With so much paint on it the radar gets the distance wrong: by up to ±9%, which is more than 50 metres at this range. The direction stays exact.\n\nEach reading is randomly off, a little more or a little less: taking the average of many readings, the errors cancel out. Read the distance 16 times, add them up and divide by 16: it is cheap, because scan with width 0 costs only 8 cycles.\n\n`painted()` tells you how painted your robot is.",
    },
    goal: { it: "Colora del tutto il bersaglio entro 110 tick.", en: "Paint the target completely within 110 ticks." },
    hints: [
      { it: "Il bersaglio è esattamente a nord-est (45 gradi): scan(45, 0) lo vede.", en: "The target is exactly north-east (45 degrees): scan(45, 0) sees it." },
      { it: "var somma = 0; for (var k = 0; k < 16; k++) { somma += scan(45, 0); } e poi throw(45, somma / 16);", en: "var sum = 0; for (var k = 0; k < 16; k++) { sum += scan(45, 0); } and then throw(45, sum / 16);" },
    ],
    starter: {
      it: `// Missione: occhiali sporchi. Il radar sbaglia la distanza:
// una lettura sola non basta.

fn main() {
  loop {
    var d = scan(45, 0);
    if (d > 0) {
      throw(45, d);
    }
  }
}
`,
      en: `// Mission: dirty goggles. The radar gets the distance wrong:
// a single reading is not enough.

fn main() {
  loop {
    var d = scan(45, 0);
    if (d > 0) {
      throw(45, d);
    }
  }
}
`,
    },
    opponents: [{ name: TARGET, source: STILL }],
    positions: [{ x: 150, y: 150 }, { x: 600, y: 600 }],
    paint: [90, 0],
    rules: { maxTicks: 110 },
    check: won,
  },
  {
    id: "dodge",
    group: "play",
    title: { it: "Schiva!", en: "Dodge!" },
    intro: {
      it: "Ora qualcuno lancia anche contro di te: l'Irrigatore sta fermo, gira il radar e lancia dove ti vede. Chi sta fermo viene colorato in fretta.\n\nUn gavettone ci mette qualche tick ad arrivare: un robot che si muove veloce, in linea retta, è già altrove quando scoppia. Ma attento ai muri, sono verniciati di fresco.\n\n`painted()` dice quanto sei colorato: se sale, è il momento di cambiare strada.",
      en: "Now someone throws at you too: the Sprinkler stands still, turns its radar and throws where it sees you. A robot that stands still gets painted fast.\n\nA balloon takes a few ticks to arrive: a robot moving fast, in a straight line, is somewhere else when it bursts. But watch out for the walls, they are freshly painted.\n\n`painted()` tells you how painted you are: if it goes up, it's time to change course.",
    },
    goal: { it: "Resta in gioco per 1000 tick (o fai uscire tu l'Irrigatore).", en: "Stay in the game for 1000 ticks (or put the Sprinkler out yourself)." },
    hints: [
      { it: "Corri tra due punti lontani dai muri, a tutta velocità: drive(atan2(…), 100).", en: "Run between two points away from the walls, at full speed: drive(atan2(…), 100)." },
      { it: "Il robot di esempio Vagabondo corre da un punto a caso all'altro: prova a partire dal suo codice.", en: "The Wanderer sample robot runs from one random point to another: try starting from its code." },
    ],
    starter: {
      it: `// Missione: schiva i gavettoni dell'Irrigatore.
// Questo robot sta fermo e lancia: dura poco.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      throw(dir, d);
      print("colorato al", painted(), "%");
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
      en: `// Mission: dodge the Sprinkler's balloons.
// This robot stands still and throws: it doesn't last long.

var dir = 0;

fn main() {
  loop {
    var d = scan(dir, 10);
    if (d > 0) {
      throw(dir, d);
      print("painted", painted(), "%");
    } else {
      dir = (dir + 20) % 360;
    }
  }
}
`,
    },
    basic: {
      hints: [
        { it: "Corri tra due punti lontani dai muri, a tutta velocità: drive_to(x, y, 100), e quando dist_to(x, y) è piccola scegli un'altra meta.", en: "Run between two points away from the walls, at full speed: drive_to(x, y, 100), and when dist_to(x, y) gets small pick another destination." },
        { it: "Il robot di esempio Vagabondo corre da un punto a caso all'altro: parti dal suo codice e in nuovaMeta() scrivi drive_to(mx, my, 100) al posto della riga con drive.", en: "The Wanderer sample robot runs from one random point to another: start from its code and in newDestination() write drive_to(tx, ty, 100) instead of the line with drive." },
      ],
    },
    opponents: [{ name: { it: "Irrigatore", en: "Sprinkler" }, sample: "sprinkler" }],
    positions: [{ x: 800, y: 500 }, { x: 500, y: 500 }],
    rules: { maxTicks: 1000 },
    check: (rep) => !last(rep).robots[0].out,
  },
  {
    id: "duel",
    group: "play",
    title: { it: "Prima sfida", en: "First match" },
    intro: {
      it: "Una sfida vera, uno contro uno, contro l'Irrigatore: sta fermo e fa girare il radar; quando ti vede, lancia.\n\nOgni partita parte da posizioni diverse. Se perdi, guarda il replay: dove ti ha colpito? Saresti riuscito a vederlo prima?",
      en: "A real match, one against one, against the Sprinkler: it stands still and turns its radar; when it sees you, it throws.\n\nEvery match starts from different positions. If you lose, watch the replay: where did it hit you? Could you have seen it first?",
    },
    goal: { it: "Fai uscire dal gioco l'Irrigatore.", en: "Put the Sprinkler out of the game." },
    hints: [
      { it: "Chi sta fermo è facile da colpire: muoversi aiuta.", en: "Standing still makes you easy to hit: moving helps." },
      { it: "Riusa la mira precisa, e controlla painted(): se sale, cambia posto.", en: "Reuse the precise aim, and check painted(): if it rises, move elsewhere." },
    ],
    starter: { it: "", en: "" },
    opponents: [{ name: { it: "Irrigatore", en: "Sprinkler" }, sample: "sprinkler" }],
    randomSeed: true,
    check: won,
  },
  {
    id: "melee",
    group: "play",
    title: { it: "Tutti contro tutti", en: "Free for all" },
    intro: {
      it: "La prova finale: quattro robot nell'arena, vince l'ultimo che resta in gioco. Gli avversari sono Vagabondo, Angolo e Inseguitore.\n\nQui non basta mirare bene: bisogna anche non farsi colorare da tre robot insieme.",
      en: "The final test: four robots in the arena, the last one still in the game wins. The opponents are Wanderer, Corner and Chaser.\n\nAiming well isn't enough here: you must also avoid being painted by three robots at once.",
    },
    goal: { it: "Vinci una partita a quattro.", en: "Win a four-robot match." },
    hints: [
      { it: "Gli angoli sono comodi: da lì basta sorvegliare 90 gradi. Ma anche Angolo lo sa.", en: "Corners are handy: from there you only need to watch 90 degrees. But Corner knows that too." },
      { it: "Leggi il codice degli esempi (menu «Nuovo» nella modalità libera) per capire come ragionano.", en: "Read the example robots (the “New” menu in free play) to see how they think." },
    ],
    starter: { it: "", en: "" },
    opponents: [
      { name: { it: "Vagabondo", en: "Wanderer" }, sample: "wanderer" },
      { name: { it: "Angolo", en: "Corner" }, sample: "corner" },
      { name: { it: "Inseguitore", en: "Chaser" }, sample: "chaser" },
    ],
    randomSeed: true,
    check: won,
  },
];

/** The mission as seen in a path: the basic texts replace the advanced ones where present. */
export function missionView(m: Mission, path: LearnPath): Mission {
  return path === "basic" && m.basic ? { ...m, ...m.basic } : m;
}

/** The missions of a path, in order, with its texts. */
export function missionsFor(path: LearnPath): Mission[] {
  return MISSIONS.filter((m) => !m.only || m.only === path).map((m) => missionView(m, path));
}

/**
 * The forbidden functions the code calls (comments and strings excluded):
 * the mission cannot be attempted with them.
 */
export function forbiddenCalls(m: Mission, source: string): string[] {
  if (!m.forbid?.length) return [];
  const code = source.replace(/\/\*[\s\S]*?(\*\/|$)|\/\/[^\n]*|"(\\.|[^"\\\n])*"?/g, " ");
  return m.forbid.filter((f) => new RegExp(`\\b${f}\\s*\\(`).test(code));
}

/** True if the text contains the distance between the two robots (in metres, with 2 m tolerance). */
function printsDistance(text: string, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const d = Math.hypot(a.x - b.x, a.y - b.y) / 1000;
  return (text.match(/-?\d+/g) ?? []).some((n) => Math.abs(Number(n) - d) <= 2);
}

export function missionRules(m: Mission): Rules {
  return { ...RULES_V0, ...m.rules };
}

/** Prepares a mission's opponents; `samples` resolves sample robot ids. */
export function missionOpponents(m: Mission, lang: Lang, samples: (id: string) => string | undefined): Entrant[] {
  const rules = missionRules(m);
  return m.opponents.map((o) => {
    const src = o.source ?? samples(o.sample!) ?? "";
    const c = compile(src, rules);
    if (!c.ok) throw new Error(`invalid opponent in mission ${m.id}`);
    return { name: o.name[lang], program: c.program! };
  });
}

/** Plays and records a mission: the user's robot first, then the opponents. */
export function playMission(m: Mission, entrants: Entrant[], seed: number, profile = false): Replay {
  return recordMatch(entrants, { seed, profile, rules: missionRules(m), positions: m.positions, paint: m.paint, until: m.until?.() });
}
