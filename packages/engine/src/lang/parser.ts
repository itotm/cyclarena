// Recursive-descent parser. It stops at the first error: for a learner,
// one precise error is clearer than a cascade of derived errors.

import type { Expr, Pos, Stmt, Target, TopDecl } from "./ast.ts";
import { CompileError } from "./diagnostics.ts";
import type { MsgArg } from "../i18n.ts";
import { tokenize, type Token } from "./lexer.ts";

// precedence of binary operators, from weakest to strongest (as in C)
const BINARY_LEVELS: string[][] = [
  ["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", "<=", ">", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"],
];
const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);

function describe(t: Token): MsgArg {
  switch (t.kind) {
    case "eof": return { code: "T_EOF", args: [] };
    case "num": return { code: "T_NUMBER", args: [t.text] };
    case "ident": return { code: "T_IDENT", args: [t.text] };
    case "str": return { code: "T_STRING", args: [] };
    default: return { code: "T_SYMBOL", args: [t.text] };
  }
}

export function parse(src: string): TopDecl[] {
  const toks = tokenize(src);
  let p = 0;

  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const pos = (t: Token): Pos => ({ line: t.line, col: t.col, end: t.end });
  const is = (text: string, o = 0) => { const t = peek(o); return (t.kind === "sym" || t.kind === "kw") && t.text === text; };
  const fail = (code: string, args: MsgArg[], t = peek()): never => { throw new CompileError(code, args, t.line, t.col, t.end); };
  const next = () => toks[p++];
  const expect = (text: string): Token => {
    if (is(text)) return next();
    return fail("E_EXPECTED", [{ code: "T_SYMBOL", args: [text] }, describe(peek())]);
  };
  const expectIdent = (): Token => {
    if (peek().kind === "ident") return next();
    return fail("E_EXPECTED", [{ code: "T_IDENT", args: ["…"] }, describe(peek())]);
  };

  // --- expressions ---

  function expr(): Expr { return binary(0); }

  function binary(level: number): Expr {
    if (level === BINARY_LEVELS.length) return unary();
    let left = binary(level + 1);
    while (peek().kind === "sym" && BINARY_LEVELS[level].includes(peek().text)) {
      const opTok = next();
      const right = binary(level + 1);
      left = { k: "bin", op: opTok.text, l: left, r: right, pos: pos(opTok) };
    }
    if (level === 0 && is("=")) fail("E_ASSIGN_IN_EXPR", []);
    return left;
  }

  function unary(): Expr {
    const t = peek();
    if (t.kind === "sym" && (t.text === "-" || t.text === "!" || t.text === "~")) {
      next();
      const e = unary();
      // -2147483648 is a valid literal
      if (t.text === "-" && e.k === "num") return { k: "num", v: -e.v | 0, pos: pos(t) };
      return { k: "un", op: t.text, e, pos: pos(t) };
    }
    if (t.kind === "sym" && t.text === "+") { next(); return unary(); }
    return primary();
  }

  function primary(): Expr {
    const t = peek();
    if (t.kind === "num") { next(); return { k: "num", v: t.value | 0, pos: pos(t) }; }
    if (t.kind === "str") { next(); return { k: "str", s: t.text, pos: pos(t) }; }
    if (t.kind === "kw" && (t.text === "true" || t.text === "false")) {
      next();
      return { k: "num", v: t.text === "true" ? 1 : 0, pos: pos(t) };
    }
    if (t.kind === "ident") {
      next();
      if (is("(")) {
        next();
        const args: Expr[] = [];
        if (!is(")")) {
          do { args.push(expr()); } while (is(",") && next());
        }
        const close = expect(")");
        return { k: "call", name: t.text, args, pos: { line: t.line, col: t.col, end: close.end } };
      }
      if (is("[")) {
        next();
        const index = expr();
        const close = expect("]");
        return { k: "index", name: t.text, index, pos: { line: t.line, col: t.col, end: close.end } };
      }
      return { k: "name", name: t.text, pos: pos(t) };
    }
    if (is("(")) { next(); const e = expr(); expect(")"); return e; }
    return fail("E_EXPR", [describe(t)]);
  }

  // --- statements ---

  function block(owner: string): Stmt[] {
    if (!is("{")) fail("E_BRACES", [owner]);
    next();
    const body: Stmt[] = [];
    while (!is("}")) {
      if (peek().kind === "eof") expect("}");
      body.push(statement());
    }
    next();
    return body;
  }

  function varDecl(): Extract<Stmt, { k: "var" }> {
    const kw = next(); // var
    const name = expectIdent();
    let size: Expr | undefined, init: Expr | undefined;
    if (is("[")) { next(); size = expr(); expect("]"); }
    if (is("=")) { next(); init = expr(); }
    expect(";");
    return { k: "var", name: name.text, size, init, pos: { line: kw.line, col: name.col, end: name.end } };
  }

  // assignment, ++/-- or call (without the semicolon)
  function simple(): Stmt {
    const t = peek();
    if (t.kind !== "ident") return fail("E_STMT", [describe(t)]);
    const e = primary();
    if (e.k === "call") {
      if (peek().kind === "sym" && (ASSIGN_OPS.has(peek().text) || is("++") || is("--")))
        fail("E_BAD_TARGET", [peek().text]);
      return { k: "call", call: e, pos: e.pos };
    }
    const target: Target = e.k === "index"
      ? { name: e.name, index: e.index, pos: e.pos }
      : { name: (e as { name: string }).name, pos: e.pos };
    const op = peek();
    if (op.kind === "sym" && (op.text === "++" || op.text === "--")) {
      next();
      return { k: "incdec", target, op: op.text, pos: e.pos };
    }
    if (op.kind === "sym" && ASSIGN_OPS.has(op.text)) {
      next();
      const value = expr();
      return { k: "assign", target, op: op.text, value, pos: e.pos };
    }
    return fail("E_EXPECTED", [{ code: "T_SYMBOL", args: ["="] }, describe(op)]);
  }

  function statement(): Stmt {
    const t = peek();
    if (t.kind === "kw") {
      switch (t.text) {
        case "var": return varDecl();
        case "if": return ifStmt();
        case "while": {
          next(); expect("("); const cond = expr(); expect(")");
          return { k: "while", cond, body: block("while"), pos: pos(t) };
        }
        case "loop": next(); return { k: "loop", body: block("loop"), pos: pos(t) };
        case "for": {
          next(); expect("(");
          let init: Stmt | undefined;
          if (is("var")) init = varDecl(); // also consumes the ";"
          else { init = is(";") ? undefined : simple(); expect(";"); }
          const cond = is(";") ? undefined : expr(); expect(";");
          const step = is(")") ? undefined : simple(); expect(")");
          return { k: "for", init, cond, step, body: block("for"), pos: pos(t) };
        }
        case "break": next(); expect(";"); return { k: "break", pos: pos(t) };
        case "continue": next(); expect(";"); return { k: "continue", pos: pos(t) };
        case "return": {
          next();
          const value = is(";") ? undefined : expr();
          expect(";");
          return { k: "return", value, pos: pos(t) };
        }
      }
    }
    if (is("{")) return { k: "block", body: block("{ }"), pos: pos(t) };
    const s = simple();
    expect(";");
    return s;
  }

  function ifStmt(): Stmt {
    const t = next(); // if
    expect("(");
    const cond = expr();
    expect(")");
    const then = block("if");
    let els: Stmt[] | undefined;
    if (is("else")) {
      next();
      els = is("if") ? [ifStmt()] : block("else");
    }
    return { k: "if", cond, then, else: els, pos: pos(t) };
  }

  // --- top level ---

  const decls: TopDecl[] = [];
  while (peek().kind !== "eof") {
    const t = peek();
    if (is("const")) {
      next();
      const name = expectIdent();
      expect("=");
      const value = expr();
      expect(";");
      decls.push({ k: "const", name: name.text, value, pos: pos(name) });
    } else if (is("var")) {
      decls.push(varDecl());
    } else if (is("fn")) {
      next();
      const name = expectIdent();
      expect("(");
      const params: { name: string; pos: Pos }[] = [];
      if (!is(")")) {
        do { const pt = expectIdent(); params.push({ name: pt.text, pos: pos(pt) }); } while (is(",") && next());
      }
      expect(")");
      const body = block("fn " + name.text);
      decls.push({ k: "fn", name: name.text, params, body, pos: pos(name), endLine: toks[p - 1].line });
    } else {
      fail("E_TOPLEVEL", [describe(t)]);
    }
  }
  return decls;
}
