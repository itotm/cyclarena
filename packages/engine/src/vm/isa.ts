// The instruction set of the paintarena virtual machine.
// Each instruction takes three integers in the code: [opcode, a, b].
// The cost in cycles is fixed and public: it is the basis of the optimization game.

export const Op = {
  HALT: 0,   // end of program: the robot stays still, waiting
  PUSH: 1,   // a = constant                       → push a
  POP: 2,    // discards the top value
  LDG: 3,    // a = global address                 → push mem[a]
  STG: 4,    // a = global address                 mem[a] = pop
  LDL: 5,    // a = local offset                   → push mem[fp+a]
  STL: 6,    // a = local offset                   mem[fp+a] = pop
  LDGI: 7,   // a = global base, b = length        i = pop → push mem[a+i]
  STGI: 8,   // a = global base, b = length        v = pop, i = pop, mem[a+i] = v
  LDLI: 9,   // like LDGI but relative to fp
  STLI: 10,  // like STGI but relative to fp
  ADD: 11, SUB: 12, MUL: 13, DIV: 14, MOD: 15,
  NEG: 16, NOT: 17, BNOT: 18,
  AND: 19, OR: 20, XOR: 21, SHL: 22, SHR: 23,
  EQ: 24, NE: 25, LT: 26, LE: 27, GT: 28, GE: 29,
  JMP: 30,   // a = target
  JZ: 31,    // jump to a if pop == 0
  JNZ: 32,   // jump to a if pop != 0
  CALL: 33,  // a = target, b = number of arguments
  ENTER: 34, // a = local variables, b = maximum stack depth
  RET: 35,   // a = number of arguments
  SYS: 36,   // a = system function (see BUILTINS), b = extra data
  DUP: 37,   // duplicates the top value
} as const;

export type OpCode = (typeof Op)[keyof typeof Op];

export const OP_NAMES: string[] = [];
for (const [name, code] of Object.entries(Op)) OP_NAMES[code] = name;

/** Cost in cycles of each instruction. SYS costs 0: the called function pays. */
export const OP_COST = new Int32Array(64);
{
  const c = (ops: number[], cost: number) => { for (const o of ops) OP_COST[o] = cost; };
  c([Op.HALT, Op.PUSH, Op.POP, Op.DUP, Op.LDG, Op.STG, Op.LDL, Op.STL], 1);
  c([Op.LDGI, Op.STGI, Op.LDLI, Op.STLI], 2);
  c([Op.ADD, Op.SUB, Op.NEG, Op.NOT, Op.BNOT, Op.AND, Op.OR, Op.XOR, Op.SHL, Op.SHR], 1);
  c([Op.EQ, Op.NE, Op.LT, Op.LE, Op.GT, Op.GE], 1);
  c([Op.MUL], 2);
  c([Op.DIV, Op.MOD], 6);
  c([Op.JMP, Op.JZ, Op.JNZ], 1);
  c([Op.CALL], 4);
  c([Op.ENTER], 1);
  c([Op.RET], 2);
  c([Op.SYS], 0);
}

/** System functions available to robots. */
export interface Builtin {
  id: number;
  name: string;
  params: string[];
  /** Base cost in cycles. */
  cost: number;
  /** Description of the variable cost, if any (for the manual). */
  extraCost?: string;
  /** true if the function returns nothing useful (it evaluates to 0). */
  noValue?: boolean;
}

export const BUILTINS: Builtin[] = [
  { id: 0, name: "scan", params: ["dir", "res"], cost: 8, extraCost: "+2 × res" },
  { id: 1, name: "throw", params: ["dir", "dist"], cost: 5 },
  { id: 2, name: "drive", params: ["dir", "speed"], cost: 5, noValue: true },
  { id: 3, name: "painted", params: [], cost: 1 },
  { id: 4, name: "speed", params: [], cost: 1 },
  { id: 5, name: "heading", params: [], cost: 1 },
  { id: 6, name: "loc_x", params: [], cost: 1 },
  { id: 7, name: "loc_y", params: [], cost: 1 },
  { id: 8, name: "time", params: [], cost: 1 },
  { id: 9, name: "rand", params: ["n"], cost: 2 },
  { id: 10, name: "sin", params: ["deg"], cost: 4 },
  { id: 11, name: "cos", params: ["deg"], cost: 4 },
  { id: 12, name: "atan2", params: ["y", "x"], cost: 12 },
  { id: 13, name: "sqrt", params: ["n"], cost: 12 },
  { id: 14, name: "abs", params: ["n"], cost: 1 },
  { id: 15, name: "yield", params: [], cost: 1, extraCost: "+ remaining cycles in the tick", noValue: true },
  { id: 16, name: "print", params: ["…"], cost: 1, noValue: true },
  { id: 17, name: "mark", params: ["x", "y"], cost: 1, noValue: true },
];

export const Sys = {
  scan: 0, throw: 1, drive: 2, painted: 3, speed: 4, heading: 5, loc_x: 6, loc_y: 7,
  time: 8, rand: 9, sin: 10, cos: 11, atan2: 12, sqrt: 13, abs: 14, yield: 15, print: 16, mark: 17,
} as const;

export const BUILTIN_BY_NAME = new Map(BUILTINS.map((b) => [b.name, b]));

/** Predefined constants, usable in any program. */
export const BUILTIN_CONSTS: Record<string, number> = {
  ARENA: 1000,
  MAX_RANGE: 700,
  SCALE: 10000,
  MAX_RES: 10,
};
