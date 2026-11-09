// Code generation. The compiler is deliberately simple and predictable:
// it does not optimize, so every line costs exactly what it reads.
// The only documented exceptions: constants become a PUSH, and the conditions
// of if/while/for with && and || jump without computing the 0/1 value.

import type { Expr, Stmt, Target, TopDecl } from "./ast.ts";
import { CompileError, type Diagnostic } from "./diagnostics.ts";
import type { MsgArg } from "../i18n.ts";
import { parse } from "./parser.ts";
import { BUILTIN_BY_NAME, BUILTIN_CONSTS, BUILTINS, OP_COST, Op, Sys } from "../vm/isa.ts";
import type { FunctionInfo, Program, VarInfo } from "../vm/program.ts";
import { MIN_STACK, RULES_V0, type Rules } from "../rules.ts";

export interface CompileResult {
  ok: boolean;
  program?: Program;
  diagnostics: Diagnostic[];
}

interface GlobalSym { kind: "global"; addr: number; size: number; line: number }
interface ConstSym { kind: "const"; value: number; line: number }
interface FnSym { kind: "fn"; decl: Extract<TopDecl, { k: "fn" }>; pc: number; line: number }
type TopSym = GlobalSym | ConstSym | FnSym;

interface LocalSym { slot: number; size: number; line: number; col: number; reads: number; param: boolean }

const BIN_OPS: Record<string, number> = {
  "+": Op.ADD, "-": Op.SUB, "*": Op.MUL, "/": Op.DIV, "%": Op.MOD,
  "&": Op.AND, "|": Op.OR, "^": Op.XOR, "<<": Op.SHL, ">>": Op.SHR,
  "==": Op.EQ, "!=": Op.NE, "<": Op.LT, "<=": Op.LE, ">": Op.GT, ">=": Op.GE,
};

/** Effect of each instruction on the stack depth (except CALL and SYS). */
function stackEffect(op: number): number {
  switch (op) {
    case Op.PUSH: case Op.LDG: case Op.LDL: case Op.DUP: return 1;
    case Op.POP: case Op.STG: case Op.STL: case Op.JZ: case Op.JNZ: return -1;
    case Op.STGI: case Op.STLI: return -2;
    case Op.LDGI: case Op.LDLI: case Op.NEG: case Op.NOT: case Op.BNOT: case Op.JMP: return 0;
    default: return op in OP_NAMES_BIN ? -1 : 0;
  }
}
const OP_NAMES_BIN: Record<number, true> = {};
for (const o of Object.values(BIN_OPS)) OP_NAMES_BIN[o] = true;

/** 32-bit integer operations, identical to the machine's. */
export function evalBinary(op: string, a: number, b: number): number {
  switch (op) {
    case "+": return (a + b) | 0;
    case "-": return (a - b) | 0;
    case "*": return Math.imul(a, b);
    case "/": return (a / b) | 0;
    case "%": return (a % b) | 0;
    case "&": return a & b;
    case "|": return a | b;
    case "^": return a ^ b;
    case "<<": return a << (b & 31);
    case ">>": return a >> (b & 31);
    case "==": return a === b ? 1 : 0;
    case "!=": return a !== b ? 1 : 0;
    case "<": return a < b ? 1 : 0;
    case "<=": return a <= b ? 1 : 0;
    case ">": return a > b ? 1 : 0;
    case ">=": return a >= b ? 1 : 0;
    case "&&": return a !== 0 && b !== 0 ? 1 : 0;
    case "||": return a !== 0 || b !== 0 ? 1 : 0;
  }
  throw new Error("unknown operator " + op);
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function compile(source: string, rules: Rules = RULES_V0): CompileResult {
  const diagnostics: Diagnostic[] = [];
  let decls: TopDecl[];
  try {
    decls = parse(source);
  } catch (e) {
    if (e instanceof CompileError) return { ok: false, diagnostics: [e.diag] };
    throw e;
  }

  const ops: number[] = [], as: number[] = [], bs: number[] = [], lines: number[] = [];
  const formats: (string | null)[][] = [];
  const functions: FunctionInfo[] = [];
  const vars: VarInfo[] = [];
  const top = new Map<string, TopSym>();
  const callFixups: { at: number; name: string }[] = [];
  // variable cost already known at compile time (scan with a constant width)
  const knownExtra = new Map<number, number>();
  let curLine = 1;
  let depth = 0, maxDepth = 0;

  const err = (code: string, args: MsgArg[], p: { line: number; col: number; end: number }): never => {
    throw new CompileError(code, args, p.line, p.col, p.end);
  };
  const warn = (code: string, args: (string | number)[], p: { line: number; col: number; end: number }) => {
    diagnostics.push({ severity: "warning", code, args, line: p.line, col: p.col, endCol: Math.max(p.end, p.col + 1) });
  };

  function emit(op: number, a = 0, b = 0): number {
    ops.push(op); as.push(a); bs.push(b); lines.push(curLine);
    depth += stackEffect(op);
    if (depth > maxDepth) maxDepth = depth;
    return ops.length - 1;
  }
  const here = () => ops.length;
  // labels: list of jumps to patch once the target is known
  type Label = { pc: number; refs: number[] };
  const newLabel = (): Label => ({ pc: -1, refs: [] });
  const jump = (op: number, l: Label) => { const at = emit(op, l.pc); if (l.pc < 0) l.refs.push(at); };
  const place = (l: Label) => { l.pc = here(); for (const r of l.refs) as[r] = l.pc; };

  // --- global symbols ---

  function checkName(name: string, p: { line: number; col: number; end: number }) {
    if (BUILTIN_BY_NAME.has(name) || name in BUILTIN_CONSTS) err("E_BUILTIN_NAME", [name], p);
    const prev = top.get(name);
    if (prev) err("E_DUP", [name, prev.line], p);
  }

  function evalConst(e: Expr): number {
    switch (e.k) {
      case "num": return e.v;
      case "name": {
        if (e.name in BUILTIN_CONSTS) return BUILTIN_CONSTS[e.name];
        const s = top.get(e.name);
        if (s?.kind === "const") return s.value;
        if (!s) unknown(e.name, e.pos);
        return err("E_NOT_CONST", [], e.pos);
      }
      case "un": {
        const v = evalConst(e.e);
        return e.op === "-" ? -v | 0 : e.op === "!" ? (v === 0 ? 1 : 0) : ~v;
      }
      case "bin": {
        const a = evalConst(e.l), b = evalConst(e.r);
        if ((e.op === "/" || e.op === "%") && b === 0) err("E_CONST_DIV0", [], e.pos);
        return evalBinary(e.op, a, b);
      }
      default: return err("E_NOT_CONST", [], e.pos);
    }
  }

  // --- current function ---

  let scopes: Map<string, LocalSym>[] = [];
  let allLocals: { name: string; sym: LocalSym }[] = [];
  let nextSlot = 0, maxSlot = 0, curParams = 0, curFn: string | null = null;
  const loops: { brk: Label; cont: Label }[] = [];

  function lookupLocal(name: string): LocalSym | undefined {
    for (let i = scopes.length - 1; i >= 0; i--) { const s = scopes[i].get(name); if (s) return s; }
    return undefined;
  }

  function unknown(name: string, p: { line: number; col: number; end: number }): never {
    const candidates = [...top.keys(), ...BUILTINS.map((b) => b.name), ...Object.keys(BUILTIN_CONSTS)];
    for (const sc of scopes) candidates.push(...sc.keys());
    let best = "", bestD = Infinity;
    for (const c of candidates) {
      if (c === name) continue;   // same name (for example a system function used as a variable): no suggestion
      const d = editDistance(name.toLowerCase(), c.toLowerCase());
      if (d < bestD) { bestD = d; best = c; }
    }
    if (bestD <= (name.length <= 3 ? 1 : 2)) err("E_UNKNOWN_HINT", [name, best], p);
    return err("E_UNKNOWN", [name], p);
  }

  function declareLocal(name: string, size: number, p: { line: number; col: number; end: number }, param: boolean): LocalSym {
    if (BUILTIN_BY_NAME.has(name) || name in BUILTIN_CONSTS) err("E_BUILTIN_NAME", [name], p);
    const scope = scopes[scopes.length - 1];
    const prev = scope.get(name);
    if (prev) err("E_DUP", [name, prev.line], p);
    const sym: LocalSym = { slot: nextSlot, size, line: p.line, col: p.col, reads: 0, param };
    nextSlot += Math.max(size, 1);
    maxSlot = Math.max(maxSlot, nextSlot);
    scope.set(name, sym);
    allLocals.push({ name, sym });
    vars.push({ name, fn: curFn, addr: sym.slot, size, line: p.line });
    return sym;
  }

  // --- expressions ---

  function genExpr(e: Expr): void {
    curLine = e.pos.line;
    switch (e.k) {
      case "num": emit(Op.PUSH, e.v); return;
      case "str": err("E_STRING_PLACE", [], e.pos); return;
      case "name": {
        const l = lookupLocal(e.name);
        if (l) {
          if (l.size) err("E_IS_ARRAY", [e.name], e.pos);
          l.reads++;
          emit(Op.LDL, l.slot);
          return;
        }
        if (e.name in BUILTIN_CONSTS) { emit(Op.PUSH, BUILTIN_CONSTS[e.name]); return; }
        const s = top.get(e.name);
        if (!s) { if (BUILTIN_BY_NAME.has(e.name)) err("E_IS_FUNC", [e.name], e.pos); unknown(e.name, e.pos); }
        if (s!.kind === "const") emit(Op.PUSH, s!.value);
        else if (s!.kind === "fn") err("E_IS_FUNC", [e.name], e.pos);
        else { if (s!.size) err("E_IS_ARRAY", [e.name], e.pos); emit(Op.LDG, s!.addr); }
        return;
      }
      case "index": {
        const l = lookupLocal(e.name);
        const s = l ? undefined : top.get(e.name);
        if (!l && !s) unknown(e.name, e.pos);
        if ((l && !l.size) || (s && (s.kind !== "global" || !s.size))) err("E_NOT_ARRAY", [e.name], e.pos);
        genExpr(e.index);
        curLine = e.pos.line;
        if (l) { l.reads++; emit(Op.LDLI, l.slot, l.size); }
        else { const g = s as GlobalSym; emit(Op.LDGI, g.addr, g.size); }
        return;
      }
      case "call": genCall(e, true); return;
      case "un": {
        genExpr(e.e);
        curLine = e.pos.line;
        emit(e.op === "-" ? Op.NEG : e.op === "!" ? Op.NOT : Op.BNOT);
        return;
      }
      case "bin": {
        if (e.op === "&&" || e.op === "||") {
          const f = newLabel(), end = newLabel();
          genCondFalse(e, f);
          emit(Op.PUSH, 1);
          jump(Op.JMP, end);
          depth--; // the two branches leave a single value
          place(f);
          emit(Op.PUSH, 0);
          place(end);
          return;
        }
        genExpr(e.l);
        genExpr(e.r);
        curLine = e.pos.line;
        emit(BIN_OPS[e.op]);
        return;
      }
    }
  }

  function genCondFalse(e: Expr, f: Label): void {
    if (e.k === "bin" && e.op === "&&") { genCondFalse(e.l, f); genCondFalse(e.r, f); return; }
    if (e.k === "bin" && e.op === "||") { const t = newLabel(); genCondTrue(e.l, t); genCondFalse(e.r, f); place(t); return; }
    if (e.k === "un" && e.op === "!") { genCondTrue(e.e, f); return; }
    genExpr(e);
    curLine = e.pos.line;
    jump(Op.JZ, f);
  }

  function genCondTrue(e: Expr, t: Label): void {
    if (e.k === "bin" && e.op === "||") { genCondTrue(e.l, t); genCondTrue(e.r, t); return; }
    if (e.k === "bin" && e.op === "&&") { const f = newLabel(); genCondFalse(e.l, f); genCondTrue(e.r, t); place(f); return; }
    if (e.k === "un" && e.op === "!") { genCondFalse(e.e, t); return; }
    genExpr(e);
    curLine = e.pos.line;
    jump(Op.JNZ, t);
  }

  function genCall(e: Extract<Expr, { k: "call" }>, valueUsed: boolean): void {
    const b = BUILTIN_BY_NAME.get(e.name);
    if (b) {
      if (b.id === Sys.print) {
        if (e.args.length === 0) err("E_PRINT_EMPTY", [], e.pos);
        const fmt: (string | null)[] = [];
        let values = 0;
        for (const a of e.args) {
          if (a.k === "str") fmt.push(a.s);
          else { genExpr(a); fmt.push(null); values++; }
        }
        formats.push(fmt);
        curLine = e.pos.line;
        emit(Op.SYS, Sys.print, formats.length - 1);
        depth += 1 - values;
      } else {
        if (e.args.length !== b.params.length) err("E_ARGS", [e.name, b.params.length, e.args.length], e.pos);
        for (const a of e.args) genExpr(a);
        curLine = e.pos.line;
        const at = emit(Op.SYS, b.id);
        depth += 1 - e.args.length;
        if (b.id === Sys.scan && e.args[1].k === "num")
          knownExtra.set(at, 2 * Math.min(Math.max(e.args[1].v, 0), rules.scanMaxRes));
      }
      if (b.noValue && valueUsed) warn("W_NO_VALUE", [e.name], e.pos);
      if (depth > maxDepth) maxDepth = depth;
      return;
    }
    const s = top.get(e.name);
    if (!s) unknown(e.name, e.pos);
    if (s!.kind !== "fn") err("E_NOT_FUNC", [e.name], e.pos);
    const fn = s as FnSym;
    if (e.args.length !== fn.decl.params.length) err("E_ARGS", [e.name, fn.decl.params.length, e.args.length], e.pos);
    for (const a of e.args) genExpr(a);
    curLine = e.pos.line;
    maxDepth = Math.max(maxDepth, depth + 2); // return address and saved fp
    const at = emit(Op.CALL, -1, e.args.length);
    callFixups.push({ at, name: e.name });
    depth += 1 - e.args.length;
  }

  // --- statements ---

  function load(t: Target, l: LocalSym | undefined, g: GlobalSym | undefined) {
    if (t.index) emit(l ? Op.LDLI : Op.LDGI, l ? l.slot : g!.addr, l ? l.size : g!.size);
    else emit(l ? Op.LDL : Op.LDG, l ? l.slot : g!.addr);
  }
  function store(t: Target, l: LocalSym | undefined, g: GlobalSym | undefined) {
    if (t.index) emit(l ? Op.STLI : Op.STGI, l ? l.slot : g!.addr, l ? l.size : g!.size);
    else emit(l ? Op.STL : Op.STG, l ? l.slot : g!.addr);
  }

  function genAssign(t: Target, op: string, value: Expr | null, opText: string) {
    const l = lookupLocal(t.name);
    let g: GlobalSym | undefined;
    if (!l) {
      const s = top.get(t.name);
      if (!s) { if (t.name in BUILTIN_CONSTS) err("E_CONST_ASSIGN", [t.name], t.pos); unknown(t.name, t.pos); }
      if (s!.kind === "const") err("E_CONST_ASSIGN", [t.name], t.pos);
      if (s!.kind === "fn") err("E_BAD_TARGET", [opText], t.pos);
      g = s as GlobalSym;
    }
    const size = l ? l.size : g!.size;
    if (t.index && !size) err("E_NOT_ARRAY", [t.name], t.pos);
    if (!t.index && size) err("E_IS_ARRAY", [t.name], t.pos);
    if (t.index) genExpr(t.index);
    curLine = t.pos.line;
    if (op === "=") {
      genExpr(value!);
    } else {
      if (t.index) emit(Op.DUP);
      load(t, l, g);
      if (value) genExpr(value); else emit(Op.PUSH, 1);
      curLine = t.pos.line;
      emit(BIN_OPS[op]);
    }
    curLine = t.pos.line;
    store(t, l, g);
  }

  function genBlock(body: Stmt[]) {
    scopes.push(new Map());
    for (const s of body) {
      try { genStmt(s); }
      catch (e) { if (e instanceof CompileError) diagnostics.push(e.diag); else throw e; }
    }
    scopes.pop();
  }

  function genStmt(s: Stmt): void {
    curLine = s.pos.line;
    const d0 = depth;
    switch (s.k) {
      case "var": {
        const size = s.size ? evalConst(s.size) : 0;
        if (s.size && (size < 1 || size > rules.memorySize)) err("E_ARRAY_SIZE", [rules.memorySize], s.pos);
        if (s.init && size) err("E_ARRAY_INIT", [], s.pos);
        if (s.init) genExpr(s.init); else if (!size) emit(Op.PUSH, 0);
        const sym = declareLocal(s.name, size, s.pos, false); // after the initialization: "var x = x;" uses the outer x
        curLine = s.pos.line;
        if (!size) emit(Op.STL, sym.slot);
        break;
      }
      case "assign": genAssign(s.target, s.op.slice(0, -1) || "=", s.value, s.op); break;
      case "incdec": genAssign(s.target, s.op === "++" ? "+" : "-", null, s.op); break;
      case "call": genCall(s.call, false); curLine = s.pos.line; emit(Op.POP); break;
      case "if": {
        const elseL = newLabel(), end = newLabel();
        genCondFalse(s.cond, elseL);
        genBlock(s.then);
        if (s.else) { curLine = s.pos.line; jump(Op.JMP, end); }
        place(elseL);
        if (s.else) { genBlock(s.else); place(end); }
        break;
      }
      case "while": {
        const topL = newLabel(), end = newLabel();
        place(topL);
        genCondFalse(s.cond, end);
        loops.push({ brk: end, cont: topL });
        genBlock(s.body);
        loops.pop();
        curLine = s.pos.line;
        jump(Op.JMP, topL);
        place(end);
        break;
      }
      case "loop": {
        const topL = newLabel(), end = newLabel();
        place(topL);
        loops.push({ brk: end, cont: topL });
        genBlock(s.body);
        loops.pop();
        curLine = s.pos.line;
        jump(Op.JMP, topL);
        place(end);
        break;
      }
      case "for": {
        scopes.push(new Map());
        const topL = newLabel(), cont = newLabel(), end = newLabel();
        if (s.init) genStmt(s.init);
        place(topL);
        if (s.cond) genCondFalse(s.cond, end);
        loops.push({ brk: end, cont });
        genBlock(s.body);
        loops.pop();
        place(cont);
        if (s.step) genStmt(s.step);
        curLine = s.pos.line;
        jump(Op.JMP, topL);
        place(end);
        scopes.pop();
        break;
      }
      case "break": if (!loops.length) err("E_BREAK", [], s.pos); jump(Op.JMP, loops[loops.length - 1].brk); break;
      case "continue": if (!loops.length) err("E_CONTINUE", [], s.pos); jump(Op.JMP, loops[loops.length - 1].cont); break;
      case "return": {
        if (s.value) genExpr(s.value); else emit(Op.PUSH, 0);
        curLine = s.pos.line;
        emit(Op.RET, curParams);
        break;
      }
      case "block": genBlock(s.body); break;
    }
    depth = d0; // every statement leaves the stack as it was (even after an error)
  }

  // --- program ---

  // 1. global symbols, in the order they are written
  let globals = 0;
  const globalInits: { addr: number; init: Expr }[] = [];
  for (const d of decls) {
    try {
      checkName(d.name, d.pos);
      if (d.k === "const") top.set(d.name, { kind: "const", value: evalConst(d.value), line: d.pos.line });
      else if (d.k === "var") {
        const size = d.size ? evalConst(d.size) : 0;
        if (d.size && (size < 1 || size > rules.memorySize)) err("E_ARRAY_SIZE", [rules.memorySize], d.pos);
        if (d.init && size) err("E_ARRAY_INIT", [], d.pos);
        top.set(d.name, { kind: "global", addr: globals, size, line: d.pos.line });
        vars.push({ name: d.name, fn: null, addr: globals, size, line: d.pos.line });
        if (d.init) globalInits.push({ addr: globals, init: d.init });
        globals += Math.max(size, 1);
      } else top.set(d.name, { kind: "fn", decl: d, pc: -1, line: d.pos.line });
    } catch (e) {
      if (e instanceof CompileError) diagnostics.push(e.diag); else throw e;
    }
  }
  const main = top.get("main");
  if (!main || main.kind !== "fn") diagnostics.push({ severity: "error", code: "E_NO_MAIN", args: [], line: 1, col: 1, endCol: 2 });
  else if (main.decl.params.length) {
    const p = main.decl.pos;
    diagnostics.push({ severity: "error", code: "E_MAIN_PARAMS", args: [], line: p.line, col: p.col, endCol: p.end });
  }

  // 2. startup: initialization of the globals, then main()
  curLine = main?.line ?? 1;
  depth = 0; maxDepth = 0;
  scopes = [new Map()];
  const enterInit = emit(Op.ENTER, 0, 0);
  for (const gi of globalInits) {
    try { genExpr(gi.init); curLine = gi.init.pos.line; emit(Op.STG, gi.addr); }
    catch (e) { if (e instanceof CompileError) diagnostics.push(e.diag); else throw e; }
    depth = 0;
  }
  bs[enterInit] = maxDepth;
  curLine = main?.line ?? 1;
  const restartPc = here();
  const mainCall = emit(Op.CALL, -1, 0);
  callFixups.push({ at: mainCall, name: "main" });
  emit(Op.POP);
  emit(Op.HALT);

  // 3. functions
  for (const d of decls) {
    if (d.k !== "fn") continue;
    const sym = top.get(d.name);
    if (sym?.kind !== "fn" || sym.decl !== d) continue;
    sym.pc = here();
    curFn = d.name;
    curLine = d.pos.line;
    scopes = [new Map()];
    allLocals = [];
    nextSlot = 0; maxSlot = 0; curParams = d.params.length;
    depth = 0; maxDepth = 0;
    try {
      for (const p of d.params) declareLocal(p.name, 0, p.pos, true);
    } catch (e) { if (e instanceof CompileError) diagnostics.push(e.diag); else throw e; }
    // local variables start after the return address and saved fp
    nextSlot = maxSlot = curParams + 2;
    const enter = emit(Op.ENTER, 0, 0);
    genBlock(d.body);
    const last = d.body[d.body.length - 1];
    if (!last || last.k !== "return") {
      curLine = d.endLine;
      emit(Op.PUSH, 0);
      emit(Op.RET, curParams);
    }
    as[enter] = maxSlot - (curParams + 2);
    bs[enter] = maxDepth;
    functions.push({ name: d.name, startPc: sym.pc, endPc: here(), line: d.pos.line, params: curParams });
    for (const { name, sym: l } of allLocals)
      if (!l.param && l.reads === 0) warn("W_UNUSED", [name], { line: l.line, col: l.col, end: l.col + name.length });
  }
  curFn = null;

  // 4. linking the calls
  for (const f of callFixups) {
    const s = top.get(f.name);
    if (s?.kind === "fn") as[f.at] = s.pc;
  }

  const size = ops.length;
  if (size > rules.maxCodeSize)
    diagnostics.push({ severity: "error", code: "E_CODE_SIZE", args: [size, rules.maxCodeSize, { code: "CLASS_" + rules.robotClass, args: [] }], line: 1, col: 1, endCol: 2 });
  if (globals + MIN_STACK > rules.memorySize)
    diagnostics.push({ severity: "error", code: "E_MEMORY", args: [globals, rules.memorySize - MIN_STACK, { code: "CLASS_" + rules.robotClass, args: [] }], line: 1, col: 1, endCol: 2 });

  diagnostics.sort((a, b) => a.line - b.line || a.col - b.col);
  if (diagnostics.some((d) => d.severity === "error")) return { ok: false, diagnostics };

  const code = new Int32Array(size * 3);
  for (let i = 0; i < size; i++) { code[i * 3] = ops[i]; code[i * 3 + 1] = as[i]; code[i * 3 + 2] = bs[i]; }
  const maxLine = source.split("\n").length + 1;
  const lineCost = new Int32Array(maxLine + 1);
  const lineDynamic = new Uint8Array(maxLine + 1);
  for (let i = 0; i < size; i++) {
    // the startup (initial ENTER, call to main, HALT) does not belong to lines written by the user
    if (i === 0 || (i >= restartPc && i < restartPc + 3)) continue;
    const ln = lines[i];
    if (ops[i] === Op.SYS) {
      const b = BUILTINS[as[i]];
      const extra = knownExtra.get(i);
      lineCost[ln] += b.cost + (extra ?? 0);
      if (b.extraCost && extra === undefined) lineDynamic[ln] = 1;
    } else lineCost[ln] += OP_COST[ops[i]];
  }

  return {
    ok: true,
    diagnostics,
    program: {
      code, lines: Int32Array.from(lines), size, globals, restartPc, formats, functions, vars, lineCost, lineDynamic,
    },
  };
}
