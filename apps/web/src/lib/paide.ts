// IDE helpers for the robot editor: autocompletion (system functions,
// constants, keywords with templates, the program's functions and
// variables), hover tooltips, function signature while typing the
// arguments, go to definition (Ctrl+click or F12), block folding, search
// and replace.
//
// The program is not compiled for this: a quick scan of the text is enough,
// and it works even when the code is incomplete or has errors.

import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, snippet, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { foldGutter, foldKeymap, foldService, matchBrackets } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState, Facet, Prec, StateField, type Extension } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, showTooltip, type Tooltip } from "@codemirror/view";
import { BUILTIN_CONSTS, BUILTINS, KEYWORDS, type Builtin, type Lang } from "@paintarena/engine";
import { ADVANCED_FNS, BUILTIN_DOCS, BUILTIN_EQUIV, CONST_DOCS, COORD_FNS, KEYWORD_DOCS, extraCostText } from "./builtinDocs.ts";

/** Language of the tooltips (changed by reconfiguring the editor). */
export const ideLang = Facet.define<Lang, Lang>({ combine: (v) => v[0] ?? "it" });

/**
 * Basic path (no trigonometry): the coordinate functions are suggested first
 * and sin, cos and atan2 are marked as advanced.
 */
export const ideBasic = Facet.define<boolean, boolean>({ combine: (v) => v[0] ?? false });

const T = {
  it: {
    cycles: "cicli", fn: "funzione", global: "variabile globale", local: "variabile locale", param: "parametro",
    constant: "costante", array: "array di {0}", line: "riga {0}", returnsNothing: "non restituisce niente",
    snippet: "modello", definedAt: "definita alla riga {0}", value: "vale {0}",
    advanced: "avanzato: trigonometria", same: "uguale a",
  },
  en: {
    cycles: "cycles", fn: "function", global: "global variable", local: "local variable", param: "parameter",
    constant: "constant", array: "array of {0}", line: "line {0}", returnsNothing: "returns nothing",
    snippet: "template", definedAt: "defined at line {0}", value: "equals {0}",
    advanced: "advanced: trigonometry", same: "same as",
  },
};
const tr = (lang: Lang, key: keyof (typeof T)["it"], arg: string | number = "") => T[lang][key].replace("{0}", String(arg));

/** Italian texts for search and the other CodeMirror panels. */
export const PHRASES_IT: Record<string, string> = {
  "Find": "Cerca", "Replace": "Sostituisci", "next": "successivo", "previous": "precedente", "all": "tutti",
  "match case": "maiuscole/minuscole", "regexp": "espressione regolare", "by word": "parola intera",
  "replace": "sostituisci", "replace all": "sostituisci tutti", "close": "chiudi",
  "current match": "risultato attuale", "replaced $ matches": "sostituiti $ risultati", "replaced match on line $": "sostituito il risultato alla riga $",
  "on line": "alla riga", "Go to line": "Vai alla riga", "go": "vai",
  "Folded lines": "Righe ripiegate", "Unfolded lines": "Righe aperte", "to": "a", "folded code": "codice ripiegato", "unfold": "apri",
  "Fold line": "Ripiega la riga", "Unfold line": "Apri la riga",
};

// --- program scan ---

export interface Sym {
  name: string;
  kind: "fn" | "global" | "const" | "local" | "param";
  /** Position of the name in the declaration. */
  from: number;
  params?: string[];
  /** Size, for arrays. */
  size?: string;
}

interface Scan {
  /** Functions, global variables and constants of the whole program. */
  top: Sym[];
  /** Parameters and local variables visible at the requested position. */
  locals: Sym[];
  /** The requested position is inside a comment or a string. */
  inText: boolean;
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;
const BUILTIN_BY_NAME = new Map(BUILTINS.map((b) => [b.name, b]));

/** Quick scan of the text (comments and strings excluded), up to `pos` for local variables. */
export function scanProgram(text: string, pos: number): Scan {
  const top: Sym[] = [];
  let fnLocals: (Sym & { depth: number })[] = [];
  let snapshot: Sym[] | null = null;
  let inText = false;
  let depth = 0;
  let pending: "fn" | "var" | "const" | null = null; // keyword preceding a new name
  let fnDecl: Sym | null = null;                      // function whose parameters follow
  let readingParams = false;
  let lastVar: Sym | null = null;                     // for `var a[10]`
  // `for (var i…)`: i belongs to the loop body, one level deeper
  let forPending = false, forParens = 0;
  const n = text.length;
  const mark = (start: number, end: number) => { if (pos > start && pos <= end) inText = true; };
  let i = 0;
  while (i < n) {
    if (snapshot === null && i >= pos) snapshot = fnLocals.slice();
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "/" && text[i + 1] === "/") { const e = text.indexOf("\n", i); const end = e < 0 ? n : e; mark(i, end); i = end; continue; }
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); mark(i, e < 0 ? n : e); i = e < 0 ? n : e + 2; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"' && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      mark(i, j); i = j + 1; continue;
    }
    IDENT.lastIndex = i;
    const m = IDENT.exec(text);
    if (m) {
      const w = m[0];
      lastVar = null;
      if (readingParams) {
        fnDecl!.params!.push(w);
        fnLocals.push({ name: w, kind: "param", from: i, depth: 1 });
      } else if (pending === "fn") {
        fnDecl = { name: w, kind: "fn", from: i, params: [] };
        top.push(fnDecl);
        fnLocals = [];
      } else if (pending) {
        const sym = { name: w, kind: depth === 0 ? (pending === "const" ? "const" : "global") : "local", from: i, depth: depth + (forParens > 0 ? 1 : 0) } as Sym & { depth: number };
        if (depth === 0) top.push(sym); else fnLocals.push(sym);
        lastVar = sym;
      }
      pending = w === "fn" || w === "var" || w === "const" ? w : null;
      forPending = w === "for";
      i += w.length;
      continue;
    }
    pending = null;
    if (c === "(" && (forPending || forParens > 0)) forParens++;
    else if (c === ")" && forParens > 0) forParens--;
    forPending = false;
    if (c === "(" && fnDecl && !readingParams) readingParams = true;
    else if (c === ")" && readingParams) { readingParams = false; fnDecl = null; }
    else if (c === "[" && lastVar) {
      const e = text.indexOf("]", i);
      if (e > i) lastVar.size = text.slice(i + 1, e).trim();
    } else if (c === "{") { depth++; fnDecl = null; }
    else if (c === "}") {
      depth = Math.max(0, depth - 1);
      // variables of closed blocks are no longer visible
      fnLocals = depth === 0 ? [] : fnLocals.filter((s) => s.depth <= depth);
    }
    if (c !== "[") lastVar = null;
    i++;
  }
  return { top, locals: snapshot ?? fnLocals.slice(), inText };
}

function findSym(state: EditorState, name: string, pos: number): Sym | undefined {
  const s = scanProgram(state.doc.toString(), pos);
  return [...s.locals].reverse().find((x) => x.name === name) ?? s.top.find((x) => x.name === name);
}

function wordAt(state: EditorState, pos: number): { from: number; to: number; text: string } | null {
  const line = state.doc.lineAt(pos);
  const t = line.text;
  let a = pos - line.from, b = a;
  while (a > 0 && /[A-Za-z0-9_]/.test(t[a - 1])) a--;
  while (b < t.length && /[A-Za-z0-9_]/.test(t[b])) b++;
  if (a === b || !/[A-Za-z_]/.test(t[a])) return null;
  return { from: line.from + a, to: line.from + b, text: t.slice(a, b) };
}

// --- tooltip texts ---

function costText(b: Builtin, lang: Lang): string {
  return `${b.cost}${b.extraCost ? " " + extraCostText(b, lang) : ""} ${tr(lang, "cycles")}`;
}

function signature(name: string, params: string[]): string {
  return `${name}(${params.join(", ")})`;
}

function el(tag: string, cls: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

function infoBox(head: string, sub: string, body: string, code = ""): HTMLElement {
  const box = el("div", "pa-info", "");
  box.append(el("code", "pa-info-head", head));
  if (sub) box.append(el("div", "pa-info-sub", sub));
  if (body) box.append(el("div", "pa-info-body", body));
  if (code) box.append(el("code", "pa-info-equiv", code));
  return box;
}

function describe(state: EditorState, name: string, pos: number): HTMLElement | null {
  const lang = state.facet(ideLang);
  const b = BUILTIN_BY_NAME.get(name);
  if (b) {
    const sub = costText(b, lang) + (b.noValue ? " · " + tr(lang, "returnsNothing") : "") + (ADVANCED_FNS.has(b.name) ? " · " + tr(lang, "advanced") : "");
    const equiv = BUILTIN_EQUIV[b.name];
    return infoBox(signature(b.name, b.params), sub, BUILTIN_DOCS[b.name]?.[lang] ?? "", equiv ? `${tr(lang, "same")} ${equiv}` : "");
  }
  if (name in BUILTIN_CONSTS) return infoBox(name, tr(lang, "value", BUILTIN_CONSTS[name]), CONST_DOCS[name]?.[lang] ?? "");
  if (KEYWORDS.has(name)) return infoBox(name, "", KEYWORD_DOCS[name]?.[lang] ?? "");
  const s = findSym(state, name, pos);
  if (!s) return null;
  const line = tr(lang, "line", state.doc.lineAt(s.from).number);
  if (s.kind === "fn") return infoBox("fn " + signature(s.name, s.params ?? []), `${tr(lang, "fn")} · ${line}`, "");
  const kind = s.kind === "global" ? tr(lang, "global") : s.kind === "const" ? tr(lang, "constant") : s.kind === "param" ? tr(lang, "param") : tr(lang, "local");
  return infoBox(s.size ? `${s.name}[${s.size}]` : s.name, `${kind}${s.size ? " · " + tr(lang, "array", s.size) : ""} · ${line}`, "");
}

// --- autocompletion ---

/** Inserts the template only if an opening parenthesis does not already follow. */
function callApply(name: string, template: string) {
  const apply = snippet(template);
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    if (view.state.sliceDoc(to, to + 1) === "(") view.dispatch({ changes: { from, to, insert: name }, selection: { anchor: from + name.length } });
    else apply(view, completion, from, to);
  };
}

const callTemplate = (name: string, params: string[]) => `${name}(${params.map((p) => "${" + p + "}").join(", ")})`;

const KEYWORD_SNIPPETS: { label: string; template: string }[] = [
  { label: "if", template: "if (${condition}) {\n\t${}\n}" },
  { label: "if else", template: "if (${condition}) {\n\t${}\n} else {\n\t\n}" },
  { label: "else", template: "else {\n\t${}\n}" },
  { label: "while", template: "while (${condition}) {\n\t${}\n}" },
  { label: "for", template: "for (var ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}" },
  { label: "loop", template: "loop {\n\t${}\n}" },
  { label: "fn", template: "fn ${name}(${}) {\n\t\n}" },
  { label: "return", template: "return ${};" },
];

function complete(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  if (!word && !ctx.explicit) return null;
  const from = word ? word.from : ctx.pos;
  const scan = scanProgram(ctx.state.doc.toString(), from);
  if (scan.inText) return null;
  // right after fn/var/const a new name is being chosen: no suggestions
  if (/\b(fn|var|const)\s+$/.test(ctx.state.sliceDoc(Math.max(0, from - 12), from))) return null;
  const lang = ctx.state.facet(ideLang);
  const options: Completion[] = [];
  const seen = new Set<string>();
  const add = (c: Completion) => { if (!seen.has(c.label + c.type)) { seen.add(c.label + c.type); options.push(c); } };

  for (const s of [...scan.locals].reverse()) {
    if (word && s.from === word.from) continue;
    add({ label: s.name, type: "variable", detail: s.kind === "param" ? tr(lang, "param") : tr(lang, "local"), boost: 3 });
  }
  for (const s of scan.top) {
    if (word && s.from === word.from) continue;
    const line = tr(lang, "definedAt", ctx.state.doc.lineAt(s.from).number);
    if (s.kind === "fn") add({ label: s.name, type: "function", detail: `(${(s.params ?? []).join(", ")})`, info: line, apply: callApply(s.name, callTemplate(s.name, s.params ?? [])), boost: 2 });
    else add({ label: s.name, type: s.kind === "const" ? "constant" : "variable", detail: s.kind === "const" ? tr(lang, "constant") : s.size ? tr(lang, "array", s.size) : tr(lang, "global"), info: line, boost: 2 });
  }
  const basic = ctx.state.facet(ideBasic);
  for (const b of BUILTINS) {
    const advanced = basic && ADVANCED_FNS.has(b.name);
    add({
      label: b.name, type: "function", detail: `(${b.params.join(", ")}) · ${costText(b, lang)}${advanced ? " · " + tr(lang, "advanced") : ""}`,
      info: () => describe(ctx.state, b.name, ctx.pos)!,
      apply: callApply(b.name, b.params.length && b.params[0] !== "…" ? callTemplate(b.name, b.params) : b.params[0] === "…" ? b.name + "(${})" : b.name + "()"),
      boost: advanced ? -2 : basic && COORD_FNS.has(b.name) ? 2 : 1,
    });
  }
  for (const [name, value] of Object.entries(BUILTIN_CONSTS))
    add({ label: name, type: "constant", detail: String(value), info: CONST_DOCS[name]?.[lang] });
  // keywords with a template (if, while, loop…) insert the whole block
  for (const s of KEYWORD_SNIPPETS)
    add({ label: s.label, type: "keyword", detail: tr(lang, "snippet"), info: KEYWORD_DOCS[s.label.split(" ")[0]]?.[lang], apply: snippet(s.template), boost: -1 });
  for (const k of KEYWORDS) add({ label: k, type: "keyword", info: KEYWORD_DOCS[k]?.[lang] });

  return { from, options, validFor: /^[A-Za-z0-9_]*$/ };
}

// --- function signature while typing the arguments ---

/**
 * The text with comments and strings replaced by spaces (same length), and
 * whether it ends inside one of them.
 */
export function maskText(text: string): { masked: string; inText: boolean } {
  let out = "", i = 0, inText = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    let end = -1;
    if (c === "/" && text[i + 1] === "/") { const e = text.indexOf("\n", i); end = e < 0 ? n : e; inText = e < 0; }
    else if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); end = e < 0 ? n : e + 2; inText = e < 0; }
    else if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"' && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      inText = j >= n;
      end = Math.min(n, j + 1);
    }
    if (end < 0) { out += c; i++; inText = false; continue; }
    out += text.slice(i, end).replace(/[^\n]/g, " ");
    i = end;
  }
  return { masked: out, inText };
}

function callAt(state: EditorState, pos: number): { name: string; params: string[]; index: number; open: number; cost: string } | null {
  const start = Math.max(0, pos - 1000);
  // brackets and commas inside comments and strings do not count
  const { masked: text, inText } = maskText(state.sliceDoc(start, pos));
  if (inText) return null;
  let depth = 0, commas = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text[i];
    if (c === ")" || c === "]") depth++;
    else if (c === "(" || c === "[") {
      if (depth === 0) {
        if (c === "[") return null;
        const m = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(text.slice(0, i));
        if (!m) return null;
        const name = m[1];
        const lang = state.facet(ideLang);
        const b = BUILTIN_BY_NAME.get(name);
        if (b) return { name, params: b.params, index: commas, open: start + i, cost: costText(b, lang) };
        const s = findSym(state, name, pos);
        if (s?.kind === "fn") return { name, params: s.params ?? [], index: commas, open: start + i, cost: "" };
        return null;
      }
      depth--;
    } else if (c === "," && depth === 0) commas++;
    else if ((c === ";" || c === "{" || c === "}") && depth === 0) return null;
  }
  return null;
}

const signatureField = StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) return value;
    // (also with a selection: template placeholders are selected)
    const sel = tr.state.selection.main;
    if (tr.state.selection.ranges.length > 1) return [];
    const call = callAt(tr.state, sel.from);
    if (!call || !call.params.length) return [];
    return [{
      pos: call.open,
      above: true,
      create() {
        const dom = el("div", "pa-sig", "");
        dom.append(document.createTextNode(call.name + "("));
        call.params.forEach((p, i) => {
          if (i) dom.append(document.createTextNode(", "));
          dom.append(el("span", i === Math.min(call.index, call.params.length - 1) || p === "…" ? "pa-sig-on" : "", p));
        });
        dom.append(document.createTextNode(")"));
        if (call.cost) dom.append(el("span", "pa-sig-cost", " · " + call.cost));
        return { dom };
      },
    }];
  },
  provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});

// --- go to definition ---

function goToDefinition(view: EditorView, pos: number): boolean {
  const w = wordAt(view.state, pos);
  if (!w) return false;
  const s = findSym(view.state, w.text, w.from);
  if (!s) return false;
  view.dispatch({ selection: EditorSelection.range(s.from, s.from + s.name.length), effects: EditorView.scrollIntoView(s.from, { y: "center" }) });
  view.focus();
  return true;
}

// --- folding of { … } blocks ---

const braceFolding = foldService.of((state, lineStart, lineEnd) => {
  const text = state.sliceDoc(lineStart, lineEnd);
  const code = text.replace(/\/\/.*$/, "").trimEnd();
  if (!code.endsWith("{")) return null;
  const open = lineStart + code.length - 1;
  const m = matchBrackets(state, open, 1);
  if (!m?.matched || !m.end) return null;
  if (state.doc.lineAt(m.end.from).number === state.doc.lineAt(open).number) return null;
  return { from: open + 1, to: m.end.from };
});

// --- all together ---

export function paIde(): Extension {
  return [
    closeBrackets(),
    autocompletion({ override: [complete], icons: false, activateOnTypingDelay: 50 }),
    // Tab accepts the selected suggestion like Enter; with no open list it
    // falls through to the next template field or to indentation
    Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
    hoverTooltip((view, pos) => {
      const w = wordAt(view.state, pos);
      if (!w || scanProgram(view.state.doc.toString(), w.from).inText) return null;
      const dom = describe(view.state, w.text, w.from);
      return dom ? { pos: w.from, end: w.to, above: true, create: () => ({ dom }) } : null;
    }, { hoverTime: 350 }),
    signatureField,
    search({ top: true }),
    highlightSelectionMatches({ highlightWordAroundCursor: true, minSelectionLength: 2 }),
    braceFolding,
    foldGutter({ openText: "▾", closedText: "▸" }),
    EditorState.allowMultipleSelections.of(true),
    // Ctrl+click (Cmd+click) goes to definition; Alt+click adds a cursor
    EditorView.clickAddsSelectionRange.of((e) => e.altKey),
    EditorView.domEventHandlers({
      mousedown(e, view) {
        if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null || !goToDefinition(view, pos)) return false;
        e.preventDefault();
        return true;
      },
    }),
    keymap.of([
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...foldKeymap,
      { key: "F12", run: (view) => goToDefinition(view, view.state.selection.main.head) },
    ]),
  ];
}
