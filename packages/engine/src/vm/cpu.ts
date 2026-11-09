// The interpreter: runs a robot's instructions while it has cycles left in the tick.
// Operations are on 32-bit integers with wraparound overflow, as in C.

import { iatan2, icos, isin, isqrt, normDeg, type Rng } from "../math.ts";
import type { MsgArg } from "../i18n.ts";
import { BUILTINS, OP_COST, Op, Sys } from "./isa.ts";
import type { Program } from "./program.ts";

/** CPU state of a robot. */
export interface Cpu {
  program: Program;
  mem: Int32Array;
  pc: number;
  sp: number;
  fp: number;
  /** Available cycles: if negative, it is a debt paid in the next tick. */
  balance: number;
  halted: boolean;
  /** Total cycles executed. */
  cycles: number;
  /** Runtime errors that occurred. */
  errors: number;
  /** Cycles spent on each instruction (only if profiling is enabled). */
  profile: Float64Array | null;
  rng: Rng;
}

/** What the CPU asks of the world: sensors, motors, balloons, debug. */
export interface Host {
  readonly tick: number;
  readonly recording: boolean;
  readonly scanMaxRes: number;
  scan(r: Cpu, dir: number, res: number): number;
  throwBalloon(r: Cpu, dir: number, dist: number): number;
  drive(r: Cpu, dir: number, speed: number): void;
  painted(r: Cpu): number;
  speed(r: Cpu): number;
  heading(r: Cpu): number;
  locX(r: Cpu): number;
  locY(r: Cpu): number;
  print(r: Cpu, text: string, line: number): void;
  mark(r: Cpu, x: number, y: number): void;
  trap(r: Cpu, code: string, args: MsgArg[], line: number): void;
  halt(r: Cpu): void;
}

export function resetCpu(r: Cpu): void {
  r.mem.fill(0);
  r.pc = 0;
  r.sp = r.fp = r.program.globals;
  r.balance = 0;
  r.halted = false;
}

/** Runs the robot for one tick with the given budget. */
export function runTick(r: Cpu, host: Host, budget: number): void {
  if (r.halted) return;
  const prog = r.program, code = prog.code, mem = r.mem, memSize = mem.length;
  const prof = r.profile;
  let pc = r.pc, sp = r.sp, fp = r.fp;
  let bal = r.balance + budget;
  const start = bal;
  let trapCode = "", trapArgs: MsgArg[] = [], trapPc = 0;

  run: while (bal > 0) {
    const at = pc;
    const i = pc * 3;
    const op = code[i];
    const before = bal;
    bal -= OP_COST[op];
    pc++;
    switch (op) {
      case Op.PUSH: mem[sp++] = code[i + 1]; break;
      case Op.POP: sp--; break;
      case Op.DUP: mem[sp] = mem[sp - 1]; sp++; break;
      case Op.LDG: mem[sp++] = mem[code[i + 1]]; break;
      case Op.STG: mem[code[i + 1]] = mem[--sp]; break;
      case Op.LDL: mem[sp++] = mem[fp + code[i + 1]]; break;
      case Op.STL: mem[fp + code[i + 1]] = mem[--sp]; break;
      case Op.LDGI: case Op.LDLI: {
        const idx = mem[sp - 1], len = code[i + 2];
        if (idx < 0 || idx >= len) { trapCode = "R_INDEX"; trapArgs = [idx, len - 1]; trapPc = at; break run; }
        mem[sp - 1] = mem[(op === Op.LDLI ? fp : 0) + code[i + 1] + idx];
        break;
      }
      case Op.STGI: case Op.STLI: {
        const v = mem[--sp], idx = mem[--sp], len = code[i + 2];
        if (idx < 0 || idx >= len) { trapCode = "R_INDEX"; trapArgs = [idx, len - 1]; trapPc = at; break run; }
        mem[(op === Op.STLI ? fp : 0) + code[i + 1] + idx] = v;
        break;
      }
      case Op.ADD: sp--; mem[sp - 1] = mem[sp - 1] + mem[sp]; break;
      case Op.SUB: sp--; mem[sp - 1] = mem[sp - 1] - mem[sp]; break;
      case Op.MUL: sp--; mem[sp - 1] = Math.imul(mem[sp - 1], mem[sp]); break;
      case Op.DIV: case Op.MOD: {
        const b = mem[--sp];
        if (b === 0) { trapCode = op === Op.DIV ? "R_DIV0" : "R_MOD0"; trapPc = at; break run; }
        mem[sp - 1] = op === Op.DIV ? mem[sp - 1] / b : mem[sp - 1] % b;
        break;
      }
      case Op.NEG: mem[sp - 1] = -mem[sp - 1]; break;
      case Op.NOT: mem[sp - 1] = mem[sp - 1] === 0 ? 1 : 0; break;
      case Op.BNOT: mem[sp - 1] = ~mem[sp - 1]; break;
      case Op.AND: sp--; mem[sp - 1] &= mem[sp]; break;
      case Op.OR: sp--; mem[sp - 1] |= mem[sp]; break;
      case Op.XOR: sp--; mem[sp - 1] ^= mem[sp]; break;
      case Op.SHL: sp--; mem[sp - 1] = mem[sp - 1] << (mem[sp] & 31); break;
      case Op.SHR: sp--; mem[sp - 1] = mem[sp - 1] >> (mem[sp] & 31); break;
      case Op.EQ: sp--; mem[sp - 1] = mem[sp - 1] === mem[sp] ? 1 : 0; break;
      case Op.NE: sp--; mem[sp - 1] = mem[sp - 1] !== mem[sp] ? 1 : 0; break;
      case Op.LT: sp--; mem[sp - 1] = mem[sp - 1] < mem[sp] ? 1 : 0; break;
      case Op.LE: sp--; mem[sp - 1] = mem[sp - 1] <= mem[sp] ? 1 : 0; break;
      case Op.GT: sp--; mem[sp - 1] = mem[sp - 1] > mem[sp] ? 1 : 0; break;
      case Op.GE: sp--; mem[sp - 1] = mem[sp - 1] >= mem[sp] ? 1 : 0; break;
      case Op.JMP: pc = code[i + 1]; break;
      case Op.JZ: if (mem[--sp] === 0) pc = code[i + 1]; break;
      case Op.JNZ: if (mem[--sp] !== 0) pc = code[i + 1]; break;
      case Op.CALL:
        mem[sp++] = pc;
        mem[sp++] = fp;
        fp = sp - 2 - code[i + 2];
        pc = code[i + 1];
        break;
      case Op.ENTER: {
        const k = code[i + 1];
        if (sp + k + code[i + 2] > memSize) { trapCode = "R_STACK"; trapPc = at; break run; }
        if (k) mem.fill(0, sp, sp + k);
        sp += k;
        break;
      }
      case Op.RET: {
        const n = code[i + 1];
        const v = mem[sp - 1];
        pc = mem[fp + n];
        const oldFp = mem[fp + n + 1];
        sp = fp;
        mem[sp++] = v;
        fp = oldFp;
        break;
      }
      case Op.HALT:
        r.halted = true;
        host.halt(r);
        if (bal > 0) bal = 0;
        break run;
      case Op.SYS: {
        const id = code[i + 1];
        bal -= BUILTINS[id].cost;
        switch (id) {
          case Sys.scan: {
            let res = mem[--sp];
            res = res < 0 ? 0 : res > host.scanMaxRes ? host.scanMaxRes : res;
            bal -= 2 * res;
            mem[sp - 1] = host.scan(r, normDeg(mem[sp - 1]), res);
            break;
          }
          case Sys.throw: { const dist = mem[--sp]; mem[sp - 1] = host.throwBalloon(r, normDeg(mem[sp - 1]), dist); break; }
          case Sys.drive: { const s = mem[--sp]; host.drive(r, normDeg(mem[sp - 1]), s < 0 ? 0 : s > 100 ? 100 : s); mem[sp - 1] = 0; break; }
          case Sys.painted: mem[sp++] = host.painted(r); break;
          case Sys.speed: mem[sp++] = host.speed(r); break;
          case Sys.heading: mem[sp++] = host.heading(r); break;
          case Sys.loc_x: mem[sp++] = host.locX(r); break;
          case Sys.loc_y: mem[sp++] = host.locY(r); break;
          case Sys.time: mem[sp++] = host.tick; break;
          case Sys.rand: mem[sp - 1] = r.rng.below(mem[sp - 1]); break;
          case Sys.sin: mem[sp - 1] = isin(mem[sp - 1]); break;
          case Sys.cos: mem[sp - 1] = icos(mem[sp - 1]); break;
          case Sys.atan2: { const x = mem[--sp]; mem[sp - 1] = iatan2(mem[sp - 1], x); break; }
          case Sys.sqrt: {
            const v = mem[sp - 1];
            if (v < 0) { trapCode = "R_SQRT_NEG"; trapArgs = [v]; trapPc = at; break run; }
            mem[sp - 1] = isqrt(v);
            break;
          }
          case Sys.abs: mem[sp - 1] = Math.abs(mem[sp - 1]); break;
          case Sys.yield: mem[sp++] = 0; if (bal > 0) bal = 0; break;
          case Sys.print: {
            const fmt = prog.formats[code[i + 2]];
            let n = 0;
            for (const part of fmt) if (part === null) n++;
            if (host.recording) {
              // like Python's print(): arguments separated by a space
              let k = sp - n;
              const text = fmt.map((part) => (part === null ? String(mem[k++]) : part)).join(" ");
              host.print(r, text, prog.lines[at]);
            }
            sp -= n;
            mem[sp++] = 0;
            break;
          }
          case Sys.mark: {
            const y = mem[--sp];
            if (host.recording) host.mark(r, mem[sp - 1], y);
            mem[sp - 1] = 0;
            break;
          }
        }
        break;
      }
    }
    if (prof) prof[at] += before - bal;
  }

  if (trapCode) {
    r.errors++;
    host.trap(r, trapCode, trapArgs, prog.lines[trapPc]);
    // restart from main with an empty stack; global variables are kept
    pc = prog.restartPc;
    sp = fp = prog.globals;
    if (bal > 0) bal = 0;
  }
  r.cycles += start - bal;
  r.pc = pc; r.sp = sp; r.fp = fp;
  r.balance = bal;
}
