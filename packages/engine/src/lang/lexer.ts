// Lexical analysis: turns the robot's source text into a list of tokens.

import { CompileError } from "./diagnostics.ts";

export type TokKind = "num" | "ident" | "kw" | "str" | "sym" | "eof";

export interface Token {
  kind: TokKind;
  text: string;
  value: number; // for numbers
  line: number;  // 1..
  col: number;   // 1..
  end: number;   // column after the last character
}

export const KEYWORDS = new Set([
  "fn", "var", "const", "if", "else", "while", "for", "loop", "break", "continue", "return", "true", "false",
]);

// longer symbols first, so "<=" is not read as "<" followed by "="
const SYMBOLS = [
  "<<=", ">>=",
  "==", "!=", "<=", ">=", "&&", "||", "<<", ">>", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "++", "--",
  "+", "-", "*", "/", "%", "<", ">", "=", "!", "~", "&", "|", "^", "(", ")", "{", "}", "[", "]", ",", ";",
];

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0, line = 1, lineStart = 0;
  const n = src.length;
  const col = () => i - lineStart + 1;

  while (true) {
    // whitespace and comments
    while (i < n) {
      const c = src[i];
      if (c === "\n") { i++; line++; lineStart = i; }
      else if (c === " " || c === "\t" || c === "\r") i++;
      else if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; }
      else if (c === "/" && src[i + 1] === "*") {
        const sl = line, sc = col();
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
          if (src[i] === "\n") { line++; lineStart = i + 1; }
          i++;
        }
        if (i >= n) throw new CompileError("E_COMMENT", [], sl, sc, sc + 2);
        i += 2;
      } else break;
    }
    if (i >= n) { out.push({ kind: "eof", text: "", value: 0, line, col: col(), end: col() }); return out; }

    const start = i, c0 = col(), c = src[i];

    if (c >= "0" && c <= "9") {
      while (i < n && /[0-9a-zA-Z_]/.test(src[i])) i++;
      const text = src.slice(start, i);
      const clean = text.replaceAll("_", "");
      let value: number;
      if (/^0[xX][0-9a-fA-F]+$/.test(clean)) value = parseInt(clean.slice(2), 16);
      else if (/^0[bB][01]+$/.test(clean)) value = parseInt(clean.slice(2), 2);
      else if (/^[0-9]+$/.test(clean)) value = parseInt(clean, 10);
      else throw new CompileError("E_NUMBER", [text], line, c0, col());
      // 2147483648 is allowed only so that -2147483648 can be written
      if (value > 2147483648) throw new CompileError("E_NUMBER_RANGE", [text], line, c0, col());
      out.push({ kind: "num", text, value, line, col: c0, end: col() });
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      while (i < n && /[a-zA-Z0-9_]/.test(src[i])) i++;
      const text = src.slice(start, i);
      out.push({ kind: KEYWORDS.has(text) ? "kw" : "ident", text, value: 0, line, col: c0, end: col() });
      continue;
    }

    if (c === '"') {
      i++;
      let s = "";
      while (i < n && src[i] !== '"' && src[i] !== "\n") {
        if (src[i] === "\\" && i + 1 < n) {
          const e = src[i + 1];
          s += e === "n" ? "\n" : e === "t" ? "\t" : e;
          i += 2;
        } else s += src[i++];
      }
      if (src[i] !== '"') throw new CompileError("E_STRING", [], line, c0, col());
      i++;
      out.push({ kind: "str", text: s, value: 0, line, col: c0, end: col() });
      continue;
    }

    const sym = SYMBOLS.find((s) => src.startsWith(s, i));
    if (!sym) throw new CompileError("E_CHAR", [c], line, c0, c0 + 1);
    i += sym.length;
    out.push({ kind: "sym", text: sym, value: 0, line, col: c0, end: col() });
  }
}
