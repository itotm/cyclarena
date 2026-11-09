// A robot's compiled program: it is everything needed to run it.

export interface FunctionInfo {
  name: string;
  /** First instruction (inclusive) and last (exclusive). */
  startPc: number;
  endPc: number;
  line: number;
  params: number;
}

export interface VarInfo {
  name: string;
  /** Owning function, or null for global variables. */
  fn: string | null;
  /** Global address or offset from fp. */
  addr: number;
  /** 0 for a plain variable, otherwise the array length. */
  size: number;
  line: number;
}

export interface Program {
  /** Three integers per instruction: opcode, a, b. */
  code: Int32Array;
  /** Source line of each instruction. */
  lines: Int32Array;
  /** Number of instructions. */
  size: number;
  /** Memory words taken by global variables. */
  globals: number;
  /** Instruction to restart from after an error (the call to main). */
  restartPc: number;
  /** print() formats: fixed text, or null in place of a value. */
  formats: (string | null)[][];
  functions: FunctionInfo[];
  vars: VarInfo[];
  /** Cost in cycles of each line's instructions (index = line number). */
  lineCost: Int32Array;
  /** 1 if the line contains variable-cost instructions (scan, yield). */
  lineDynamic: Uint8Array;
}
