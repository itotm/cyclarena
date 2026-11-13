// Game rules. All values are integers; internal distances are in
// millimetres (mm), those seen by robots in metres, angles in degrees.
// Changing a value changes match results: that is why the rules
// have a version, which is part of every replay.

export interface Rules {
  version: string;
  /** Robot class: sets the code and memory limits (see ROBOT_CLASSES). */
  robotClass: RobotClassId;
  /** Side of the square arena, in metres. */
  arenaSize: number;
  /** Cycles each robot receives every tick. */
  cyclesPerTick: number;
  /** Maximum length of a match, in ticks. */
  maxTicks: number;
  /** Memory of each robot (variables + stack), in 32-bit words. */
  memorySize: number;
  /** Maximum number of instructions in a program. */
  maxCodeSize: number;
  /** Movement per tick at 100% speed of a clean robot, in mm. */
  robotMaxStep: number;
  /** Maximum change in speed per tick, in percentage points. */
  accel: number;
  /** Above this speed (%) the robot cannot change direction. */
  turnSpeed: number;
  /** Movement per tick of a paint balloon, in mm. */
  balloonStep: number;
  /** Maximum throwing distance, in metres. */
  throwRange: number;
  /** Balloons in flight at the same time per robot. */
  balloonsPerRobot: number;
  /** Ticks to wait between two throws. */
  reloadTicks: number;
  /** Ticks a splash stays visible (graphics only). */
  splashTicks: number;
  /** Maximum half-width of the radar, in degrees. */
  scanMaxRes: number;
  /**
   * Paint left by a bursting balloon on the robots nearby: the first level
   * whose radius (in metres) contains the robot applies. From the nearest.
   */
  splash: readonly SplashLevel[];
  /** Paint picked up bumping into a wall (fresh paint) or into another robot. */
  bump: number;
  /** Speed lost at 100% paint, in percent (proportional below). */
  paintSlow: number;
  /** Maximum radar distance error at 100% paint, in percent (proportional below). */
  paintBlur: number;
  /** Distance below which two robots collide, in mm (on each axis). */
  collisionDistance: number;
}

export interface SplashLevel { range: number; paint: number }

export const RULES_V0: Rules = Object.freeze({
  version: "0.2",
  robotClass: "standard",
  arenaSize: 1000,
  cyclesPerTick: 50,
  maxTicks: 20000,
  memorySize: 8192,
  maxCodeSize: 4096,
  robotMaxStep: 7000,
  accel: 10,
  turnSpeed: 50,
  balloonStep: 50000,
  throwRange: 700,
  balloonsPerRobot: 2,
  reloadTicks: 15,
  splashTicks: 6,
  scanMaxRes: 10,
  // 25% at the centre, then 4 points less at each level
  splash: Object.freeze([
    { range: 5, paint: 25 },
    { range: 10, paint: 21 },
    { range: 15, paint: 17 },
    { range: 20, paint: 13 },
    { range: 30, paint: 9 },
    { range: 40, paint: 5 },
  ].map((l) => Object.freeze(l))),
  bump: 2,
  paintSlow: 25,
  paintBlur: 10,
  collisionDistance: 1000,
}) as Rules;

/** Paint left by a balloon on a robot `mm` millimetres from the burst (0 if too far). */
export function splashPaint(rules: Rules, mm: number): number {
  for (const l of rules.splash) if (mm <= l.range * 1000) return l.paint;
  return 0;
}

// --- classes ---
// Like tournament categories: a robot belongs to the smallest class it
// fits in, and can compete in that one and in all larger ones. Classes
// only change the code and memory limits: cycles and physics stay the same,
// so a robot behaves the same way in every class.

export type RobotClassId = "micro" | "mini" | "standard" | "unlimited";

export interface RobotClass {
  id: RobotClassId;
  maxCodeSize: number;
  memorySize: number;
}

export const ROBOT_CLASSES: readonly RobotClass[] = Object.freeze([
  // Micro is enough for a small but real robot (Sniper, Patrol), Mini for one
  // with an elaborate strategy (Hunter), Standard for almost anything.
  { id: "micro", maxCodeSize: 256, memorySize: 512 },
  { id: "mini", maxCodeSize: 1024, memorySize: 2048 },
  { id: "standard", maxCodeSize: 4096, memorySize: 8192 },
  { id: "unlimited", maxCodeSize: 1_000_000, memorySize: 65536 },
]);

/** Memory that must stay free beyond the global variables (for the stack). */
export const MIN_STACK = 64;

export function robotClass(id: RobotClassId): RobotClass {
  const c = ROBOT_CLASSES.find((x) => x.id === id);
  if (!c) throw new Error("unknown class: " + id);
  return c;
}

/** Rules of a class, starting from the base ones. */
export function rulesForClass(id: RobotClassId, base: Rules = RULES_V0): Rules {
  const c = robotClass(id);
  return { ...base, robotClass: id, maxCodeSize: c.maxCodeSize, memorySize: c.memorySize };
}

/** The smallest class that fits a program of `size` instructions and `globals` global words. */
export function smallestClass(size: number, globals: number): RobotClassId {
  for (const c of ROBOT_CLASSES) if (size <= c.maxCodeSize && globals + MIN_STACK <= c.memorySize) return c.id;
  return "unlimited";
}
