// Disassembler: shows the machine instructions, useful to understand
// how much each line really costs.

import { BUILTINS, OP_COST, OP_NAMES, Op } from "./isa.ts";
import type { Program } from "./program.ts";

export interface AsmLine { pc: number; line: number; text: string; cost: string; fn: string | null }

export function disassemble(p: Program): AsmLine[] {
  const out: AsmLine[] = [];
  const fnAt = new Map(p.functions.map((f) => [f.startPc, f.name]));
  let fn: string | null = null;
  for (let pc = 0; pc < p.size; pc++) {
    if (fnAt.has(pc)) fn = fnAt.get(pc)!;
    const op = p.code[pc * 3], a = p.code[pc * 3 + 1], b = p.code[pc * 3 + 2];
    let text = OP_NAMES[op], cost = String(OP_COST[op]);
    switch (op) {
      case Op.PUSH: case Op.LDG: case Op.STG: case Op.LDL: case Op.STL: case Op.JMP: case Op.JZ: case Op.JNZ: case Op.RET:
        text += " " + a; break;
      case Op.LDGI: case Op.STGI: case Op.LDLI: case Op.STLI: case Op.ENTER:
        text += ` ${a}, ${b}`; break;
      case Op.CALL: text += ` ${a} (${p.functions.find((f) => f.startPc === a)?.name ?? "?"}), ${b}`; break;
      case Op.SYS: {
        const bi = BUILTINS[a];
        text += " " + bi.name;
        cost = String(bi.cost) + (bi.extraCost ? "+" : "");
        break;
      }
    }
    out.push({ pc, line: p.lines[pc], text, cost, fn });
  }
  return out;
}
