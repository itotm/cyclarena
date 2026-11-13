<script lang="ts" module>
  export interface CostInfo {
    /** Static cost per line (index = line number). */
    cost: Int32Array | null;
    dynamic: Uint8Array | null;
    /** Fraction of the match's cycles spent on each line (0..1), if there is a profile. */
    heat: Float64Array | null;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { EditorView, GutterMarker, drawSelection, gutter, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
  import { Compartment, EditorState, StateEffect, StateField } from "@codemirror/state";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { bracketMatching, indentOnInput, indentUnit } from "@codemirror/language";
  import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
  import { message, type Diagnostic, type Lang } from "@paintarena/engine";
  import { paHighlight, paLanguage } from "./palang.ts";
  import { paIde, ideBasic, ideLang, PHRASES_IT } from "./paide.ts";

  interface Props {
    value: string;
    diagnostics: Diagnostic[];
    costs: CostInfo;
    lang: Lang;
    /** Basic path (no trigonometry): changes the order of the suggestions. */
    basic?: boolean;
  }

  let { value = $bindable(), diagnostics, costs, lang, basic = false }: Props = $props();

  const setCosts = StateEffect.define<CostInfo>();
  const costField = StateField.define<CostInfo>({
    create: () => ({ cost: null, dynamic: null, heat: null }),
    update(v, tr) {
      for (const e of tr.effects) if (e.is(setCosts)) return e.value;
      return v;
    },
  });

  class CostMarker extends GutterMarker {
    text: string;
    heat: number;
    constructor(text: string, heat: number) { super(); this.text = text; this.heat = heat; }
    eq(o: CostMarker) { return o.text === this.text && o.heat === this.heat; }
    toDOM() {
      const el = document.createElement("span");
      el.textContent = this.text;
      if (this.heat > 0) {
        el.className = "heat";
        el.style.setProperty("--heat", String(Math.min(1, 0.15 + this.heat * 3)));
      }
      return el;
    }
  }

  const costGutter = gutter({
    class: "cm-cost-gutter",
    lineMarker(view, line) {
      const info = view.state.field(costField);
      if (!info.cost) return null;
      const n = view.state.doc.lineAt(line.from).number;
      const c = info.cost[n];
      if (!c) return null;
      return new CostMarker(c + (info.dynamic?.[n] ? "+" : ""), info.heat?.[n] ?? 0);
    },
    lineMarkerChange: (u) => u.transactions.some((tr) => tr.effects.some((e) => e.is(setCosts))),
    initialSpacer: () => new CostMarker("99+", 0),
  });

  let view = $state.raw<EditorView | null>(null);

  // language of tooltips, panels and the accessible label: changed without recreating the editor
  const langConf = new Compartment();
  const langExt = (l: Lang) => [
    ideLang.of(l),
    EditorState.phrases.of(l === "it" ? PHRASES_IT : {}),
    EditorView.contentAttributes.of({ "aria-label": l === "it" ? "Codice del robot" : "Robot code" }),
  ];

  const basicConf = new Compartment();

  // the editor is created only once: the initial text is read without
  // dependencies (untrack), otherwise every keystroke would recreate the
  // editor, making it lose focus
  function attach(node: HTMLElement) {
    const v = new EditorView({
      parent: node,
      state: EditorState.create({
        doc: untrack(() => value),
        extensions: [
          costField,
          costGutter,
          lineNumbers(),
          lintGutter(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          indentUnit.of("  "),
          bracketMatching(),
          highlightActiveLine(),
          paLanguage,
          paHighlight,
          langConf.of(langExt(untrack(() => lang))),
          basicConf.of(ideBasic.of(untrack(() => basic))),
          paIde(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) value = u.state.doc.toString();
          }),
          EditorView.contentAttributes.of({ spellcheck: "false" }),
        ],
      }),
    });
    view = v;
    return () => { v.destroy(); view = null; };
  }

  // value changed from outside (e.g. loading a sample): can still be undone with Ctrl+Z
  $effect(() => {
    if (view && value !== view.state.doc.toString())
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  });

  $effect(() => {
    if (!view) return;
    const doc = view.state.doc;
    const list: CmDiagnostic[] = diagnostics.map((d) => {
      const ln = doc.line(Math.min(Math.max(d.line, 1), doc.lines));
      const from = Math.min(ln.from + d.col - 1, ln.to);
      const to = Math.max(Math.min(ln.from + d.endCol - 1, ln.to), from);
      return { from, to, severity: d.severity, message: message(d.code, d.args, lang) };
    });
    view.dispatch(setDiagnostics(view.state, list));
  });

  $effect(() => {
    view?.dispatch({ effects: setCosts.of(costs) });
  });

  $effect(() => {
    view?.dispatch({ effects: langConf.reconfigure(langExt(lang)) });
  });

  $effect(() => {
    view?.dispatch({ effects: basicConf.reconfigure(ideBasic.of(basic)) });
  });
</script>

<div class="editor h-full min-h-80 overflow-hidden rounded-panel border border-line bg-surface" {@attach attach}></div>

<style>
  .editor :global {
    .cm-editor { height: 100%; font-size: 0.9rem; }
    .cm-editor.cm-focused { outline: 1px solid var(--accent); outline-offset: -1px; }
    .cm-scroller { font-family: var(--font-mono); line-height: 1.55; font-size: 0.86rem; }
    .cm-content { caret-color: var(--text); }
    .cm-gutters { background: var(--surface); color: var(--text-dim); border-right: 1px solid var(--line); }
    .cm-activeLine { background: var(--active-line); }
    .cm-activeLineGutter { background: var(--active-line); }
    .cm-selectionBackground, &.cm-focused .cm-selectionBackground { background: var(--selection) !important; }
    .cm-cursor { border-left-color: var(--text); }
    .cm-cost-gutter .cm-gutterElement { padding: 0 6px 0 4px; text-align: right; color: var(--cost); font-variant-numeric: tabular-nums; font-size: 0.8em; }
    .cm-cost-gutter .heat { display: inline-block; padding: 0 3px; border-radius: 1px; background: color-mix(in srgb, var(--hot) calc(var(--heat) * 70%), transparent); color: var(--text); }
    .cm-tooltip { background: var(--surface-2); color: var(--text); border: 1px solid var(--line-strong); border-radius: 2px; font-family: var(--font-ui); font-size: 0.85rem; box-shadow: 0 6px 18px rgb(0 0 0 / 0.25); }
    .cm-tooltip .cm-tooltip-arrow:before { border-top-color: var(--line-strong); border-bottom-color: var(--line-strong); }
    .cm-tooltip .cm-tooltip-arrow:after { border-top-color: var(--surface-2); border-bottom-color: var(--surface-2); }

    /* tooltips (hover and completion) */
    .pa-info { max-width: 26rem; padding: 0.35rem 0.6rem 0.45rem; }
    .pa-info-head { display: block; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: var(--syn-builtin); }
    .pa-info-sub { margin-top: 0.1rem; font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); }
    .pa-info-body { margin-top: 0.3rem; line-height: 1.45; }
    .pa-info-equiv { display: block; margin-top: 0.35rem; font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); white-space: pre-wrap; }
    .pa-sig { padding: 0.2rem 0.55rem; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); }
    .pa-sig-on { color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
    .pa-sig-cost { color: var(--text-dim); }

    /* autocompletion */
    .cm-tooltip-autocomplete > ul { font-family: var(--font-mono); font-size: 0.8rem; max-height: 16rem; }
    .cm-tooltip-autocomplete > ul > li { padding: 0.1rem 0.6rem 0.1rem 0.5rem; }
    .cm-tooltip-autocomplete > ul > li[aria-selected] { background: var(--accent-soft); color: var(--text); }
    .cm-completionLabel { color: var(--text); }
    .cm-completionMatchedText { text-decoration: none; color: var(--accent); font-weight: 700; }
    .cm-completionDetail { margin-left: 0.8rem; font-style: normal; color: var(--text-dim); font-size: 0.72rem; }
    .cm-completionInfo { background: var(--surface-2); border: 1px solid var(--line-strong); padding: 0; }
    .cm-completionInfo > :not(.pa-info) { padding: 0.35rem 0.6rem; }
    .cm-snippetField { background: var(--accent-soft); border-radius: 1px; }
    .cm-snippetFieldPosition { border-left: 1px solid var(--accent); }

    /* brackets, matching words, search */
    .cm-matchingBracket { background: var(--accent-soft) !important; outline: 1px solid var(--accent); color: inherit !important; }
    .cm-nonmatchingBracket { background: color-mix(in srgb, var(--bad) 25%, transparent) !important; }
    .cm-selectionMatch { background: color-mix(in srgb, var(--accent) 14%, transparent); }
    .cm-searchMatch { background: color-mix(in srgb, var(--hot) 30%, transparent); outline: 1px solid color-mix(in srgb, var(--hot) 60%, transparent); }
    .cm-searchMatch-selected { background: color-mix(in srgb, var(--hot) 55%, transparent); }
    .cm-panels { background: var(--surface-2); color: var(--text); }
    .cm-panels-top { border-bottom: 1px solid var(--line); }
    .cm-panel.cm-search { padding: 0.35rem 0.5rem; font-family: var(--font-ui); font-size: 0.8rem; }
    .cm-panel.cm-search input, .cm-panel.cm-search button { margin: 0.1rem 0.15rem; padding: 0.15rem 0.45rem; font-size: 0.78rem; }
    .cm-button { background: var(--surface-3); background-image: none; color: var(--text); border: 1px solid var(--line); border-radius: 2px; text-transform: none; }
    .cm-button:hover { border-color: var(--line-strong); }
    .cm-textfield { background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: 2px; }
    .cm-panel.cm-search input[type=checkbox] { accent-color: var(--accent); vertical-align: middle; }
    .cm-panel.cm-search .cm-textfield { font-family: var(--font-mono); }
    .cm-panel.cm-search label { font-size: 0.75rem; color: var(--text-muted); margin: 0 0.3rem; }
    .cm-panel.cm-search [name=close] { border: none; background: none; color: var(--text-muted); font-size: 1rem; }

    /* folding */
    .cm-foldGutter .cm-gutterElement { padding: 0 3px; color: var(--text-dim); cursor: pointer; }
    .cm-foldGutter .cm-gutterElement:hover { color: var(--accent); }
    .cm-foldPlaceholder { background: var(--accent-soft); border: 1px solid var(--line-strong); color: var(--text-muted); padding: 0 0.3rem; }
  }
</style>
