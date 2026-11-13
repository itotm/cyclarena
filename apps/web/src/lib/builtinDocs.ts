// Descriptions of system functions, constants and keywords, in Italian and
// English: used by the manual and the editor (tooltips and autocompletion).

import type { Builtin, Lang } from "@paintarena/engine";

export const BUILTIN_DOCS: Record<string, { it: string; en: string }> = {
  scan: { it: "Radar: guarda nella direzione dir con un cono di ±res gradi (0–10). Restituisce la distanza in metri del robot più vicino nel cono, 0 se non c'è nessuno. Un cono stretto costa meno. Più il robot è colorato, più la distanza è imprecisa (fino a ±10% al 100%).", en: "Radar: looks towards dir with a cone of ±res degrees (0–10). Returns the distance in metres of the nearest robot in the cone, 0 if none. A narrow cone costs less. The more painted the robot, the less precise the distance (up to ±10% at 100%)." },
  throw: { it: "Lancia un gavettone di vernice nella direzione dir, che scoppia a dist metri (al massimo 700). Restituisce 1 se l'ha lanciato, 0 se deve ancora ricaricare.", en: "Throws a paint balloon towards dir, which bursts at dist metres (at most 700). Returns 1 if thrown, 0 if still reloading." },
  drive: { it: "Imposta direzione e velocità (0–100%). Sopra il 50% non si gira: il robot prima rallenta. Più il robot è colorato, più va piano (fino a −25% al 100%).", en: "Sets direction and speed (0–100%). Above 50% the robot can't turn: it slows down first. The more painted the robot, the slower it goes (up to −25% at 100%)." },
  painted: { it: "Quanto è colorato il robot, da 0 a 100 (a 100 è fuori gioco).", en: "How painted the robot is, 0 to 100 (at 100 it is out of the game)." },
  speed: { it: "Velocità attuale in %.", en: "Current speed in %." },
  heading: { it: "Direzione di marcia attuale in gradi.", en: "Current heading in degrees." },
  loc_x: { it: "Posizione x in metri (0 = bordo sinistro).", en: "x position in metres (0 = left edge)." },
  loc_y: { it: "Posizione y in metri (0 = bordo in basso).", en: "y position in metres (0 = bottom edge)." },
  time: { it: "Tick attuale della partita.", en: "Current match tick." },
  rand: { it: "Numero a caso da 0 a n−1.", en: "Random number from 0 to n−1." },
  sin: { it: "Seno di deg gradi × 10000 (sin(30) = 5000).", en: "Sine of deg degrees × 10000 (sin(30) = 5000)." },
  cos: { it: "Coseno di deg gradi × 10000.", en: "Cosine of deg degrees × 10000." },
  atan2: { it: "Direzione in gradi (0–359) del punto (x, y) visto dall'origine: atan2(ty − loc_y(), tx − loc_x()) è la direzione verso (tx, ty).", en: "Direction in degrees (0–359) of point (x, y) seen from the origin: atan2(ty − loc_y(), tx − loc_x()) points towards (tx, ty)." },
  sqrt: { it: "Radice quadrata intera.", en: "Integer square root." },
  abs: { it: "Valore assoluto.", en: "Absolute value." },
  yield: { it: "Termina subito il tick: utile quando si aspetta qualcosa, per non sprecare cicli in un ciclo vuoto.", en: "Ends the tick right away: useful while waiting, instead of burning cycles in an empty loop." },
  print: { it: "Scrive testi e numeri nella console, separati da uno spazio: print(\"distanza\", d).", en: "Writes text and numbers to the console, separated by a space: print(\"distance\", d)." },
  mark: { it: "Disegna una crocetta nell'arena nel punto (x, y), per capire cosa «pensa» il robot.", en: "Draws a small cross in the arena at (x, y), to see what the robot is “thinking”." },
  dir_to: { it: "Direzione in gradi (0–359) in cui si trova il punto (x, y), vista dal robot: drive(dir_to(x, y), 100) va verso il punto.", en: "Direction in degrees (0–359) of the point (x, y), seen from the robot: drive(dir_to(x, y), 100) heads for the point." },
  dist_to: { it: "Distanza in metri tra il robot e il punto (x, y).", en: "Distance in metres between the robot and the point (x, y)." },
  point_x: { it: "Coordinata x del punto che si trova a dist metri dal robot nella direzione dir. Con la direzione e la distanza date dal radar è la x del robot visto.", en: "x coordinate of the point dist metres from the robot towards dir. With the direction and distance from the radar it is the x of the robot seen." },
  point_y: { it: "Coordinata y del punto che si trova a dist metri dal robot nella direzione dir. Con la direzione e la distanza date dal radar è la y del robot visto.", en: "y coordinate of the point dist metres from the robot towards dir. With the direction and distance from the radar it is the y of the robot seen." },
  drive_to: { it: "Parte verso il punto (x, y) alla velocità speed (0–100%). Non si ferma da solo quando arriva: per fermarsi si controlla dist_to(x, y).", en: "Heads for the point (x, y) at speed speed (0–100%). It does not stop by itself on arrival: check dist_to(x, y) to stop." },
  throw_at: { it: "Lancia un gavettone che scoppia nel punto (x, y), se è entro 700 metri (altrimenti scoppia a 700 metri, in quella direzione). Restituisce 1 se l'ha lanciato, 0 se deve ancora ricaricare.", en: "Throws a balloon that bursts at the point (x, y), if it is within 700 metres (otherwise it bursts at 700 metres, that way). Returns 1 if thrown, 0 if still reloading." },
};

/** Groups of system functions, in the order of the manual. */
export type FnGroup = "move" | "radar" | "throw" | "coords" | "trig" | "util";

export const FN_GROUPS: { id: FnGroup; it: string; en: string; fns: string[] }[] = [
  { id: "move", it: "Movimento e posizione", en: "Movement and position", fns: ["drive", "drive_to", "speed", "heading", "loc_x", "loc_y"] },
  { id: "radar", it: "Radar", en: "Radar", fns: ["scan"] },
  { id: "throw", it: "Lancio", en: "Throwing", fns: ["throw", "throw_at", "painted"] },
  { id: "coords", it: "Coordinate", en: "Coordinates", fns: ["dir_to", "dist_to", "point_x", "point_y"] },
  { id: "trig", it: "Trigonometria (avanzato)", en: "Trigonometry (advanced)", fns: ["atan2", "sin", "cos"] },
  { id: "util", it: "Calcoli e utilità", en: "Maths and utilities", fns: ["sqrt", "abs", "rand", "time", "yield", "print", "mark"] },
];

/** Functions that need trigonometry: marked "advanced" in the editor in the basic path. */
export const ADVANCED_FNS = new Set(["atan2", "sin", "cos"]);

/** Functions that work with coordinates instead of angles: suggested first in the basic path. */
export const COORD_FNS = new Set(["dir_to", "dist_to", "point_x", "point_y", "drive_to", "throw_at"]);

/** What a coordinate function replaces: the same result and the same cost. */
export const BUILTIN_EQUIV: Record<string, string> = {
  dir_to: "atan2(y - loc_y(), x - loc_x())",
  dist_to: "sqrt(dx * dx + dy * dy)   // dx = x - loc_x(), dy = y - loc_y()",
  point_x: "loc_x() + dist * cos(dir) / SCALE",
  point_y: "loc_y() + dist * sin(dir) / SCALE",
  drive_to: "drive(dir_to(x, y), speed)",
  throw_at: "throw(dir_to(x, y), dist_to(x, y))",
};

export const CONST_DOCS: Record<string, { it: string; en: string }> = {
  ARENA: { it: "Lato dell'arena in metri.", en: "Side of the arena in metres." },
  MAX_RANGE: { it: "Distanza massima di lancio in metri.", en: "Maximum throwing distance in metres." },
  SCALE: { it: "Scala di sin() e cos(): sin(90) = SCALE.", en: "Scale of sin() and cos(): sin(90) = SCALE." },
  MAX_RES: { it: "Semiampiezza massima del radar in gradi.", en: "Maximum radar half-width in degrees." },
};

export const KEYWORD_DOCS: Record<string, { it: string; en: string }> = {
  fn: { it: "Definisce una funzione.", en: "Defines a function." },
  var: { it: "Dichiara una variabile (o un array: var a[10];).", en: "Declares a variable (or an array: var a[10];)." },
  const: { it: "Dichiara una costante, calcolata una volta per tutte.", en: "Declares a constant, computed once and for all." },
  if: { it: "Esegue un blocco solo se la condizione è vera (diversa da 0).", en: "Runs a block only if the condition is true (non-zero)." },
  else: { it: "Il blocco da eseguire quando la condizione dell'if è falsa.", en: "The block to run when the if condition is false." },
  while: { it: "Ripete un blocco finché la condizione è vera.", en: "Repeats a block while the condition is true." },
  for: { it: "Ciclo con inizializzazione, condizione e passo.", en: "Loop with initialisation, condition and step." },
  loop: { it: "Ripete un blocco per sempre (si esce con break o return).", en: "Repeats a block forever (leave with break or return)." },
  break: { it: "Esce dal ciclo più interno.", en: "Leaves the innermost loop." },
  continue: { it: "Passa al giro successivo del ciclo.", en: "Skips to the next iteration of the loop." },
  return: { it: "Esce dalla funzione, restituendo un valore.", en: "Leaves the function, returning a value." },
  true: { it: "Vale 1.", en: "Equals 1." },
  false: { it: "Vale 0.", en: "Equals 0." },
};

/** Variable part of the cost, by function (the engine's `extraCost` is the English text). */
const EXTRA_COST: Record<string, { it: string; en: string }> = {
  scan: { it: "+2 × res", en: "+2 × res" },
  yield: { it: "+ i cicli rimasti nel tick", en: "+ remaining cycles in the tick" },
};

/** Variable cost of a system function, in the requested language. */
export function extraCostText(b: Builtin, lang: Lang): string {
  if (!b.extraCost) return "";
  return EXTRA_COST[b.name]?.[lang] ?? b.extraCost;
}
