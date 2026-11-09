// paintarena language for CodeMirror: syntax highlighting, automatic
// indentation (counts open braces) and automatic bracket closing.

import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { BUILTIN_CONSTS, BUILTINS, KEYWORDS } from "@paintarena/engine";

const builtins = new Set(BUILTINS.map((b) => b.name));
const consts = new Set(Object.keys(BUILTIN_CONSTS));

export const paLanguage = StreamLanguage.define<{ comment: boolean; depth: number }>({
  name: "paintarena",
  startState: () => ({ comment: false, depth: 0 }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo("*/")) { stream.match("*/"); state.comment = false; } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) { stream.skipToEnd(); return "comment"; }
    if (stream.match("/*")) { state.comment = true; return "comment"; }
    if (stream.match(/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9][0-9_]*)/)) return "number";
    if (stream.match(/^"([^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      const w = stream.current();
      if (KEYWORDS.has(w)) return w === "true" || w === "false" ? "atom" : "keyword";
      if (builtins.has(w)) return "variableName.standard";
      if (consts.has(w)) return "atom";
      if (stream.match(/^\s*\(/, false)) return "variableName.definition";
      return "variableName";
    }
    if (stream.match(/^[+\-*/%<>=!~&|^]+/)) return "operator";
    const ch = stream.next();
    if (ch === "{") state.depth++;
    else if (ch === "}") state.depth = Math.max(0, state.depth - 1);
    return ch === "{" || ch === "}" || ch === "(" || ch === ")" || ch === "[" || ch === "]" ? "bracket" : null;
  },
  // a closing brace at the start of a line goes back to the level of the opening one
  indent: (state, textAfter, cx) => Math.max(0, state.depth - (/^\s*\}/.test(textAfter) ? 1 : 0)) * cx.unit,
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
    indentOnInput: /^\s*\}$/,
  },
});

export const paHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syn-keyword)", fontWeight: "600" },
  { tag: tags.comment, color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: tags.number, color: "var(--syn-number)" },
  { tag: tags.atom, color: "var(--syn-number)" },
  { tag: tags.string, color: "var(--syn-string)" },
  { tag: tags.standard(tags.variableName), color: "var(--syn-builtin)", fontWeight: "600" },
  { tag: tags.definition(tags.variableName), color: "var(--syn-fn)" },
  { tag: tags.operator, color: "var(--syn-operator)" },
]));
