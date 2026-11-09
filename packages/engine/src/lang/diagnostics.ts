import { message, type Lang, type MsgArg } from "../i18n.ts";

export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  args: MsgArg[];
  line: number;
  col: number;
  endCol: number;
}

export class CompileError extends Error {
  readonly diag: Diagnostic;
  constructor(code: string, args: MsgArg[], line: number, col: number, endCol: number) {
    super(code);
    this.diag = { severity: "error", code, args, line, col, endCol: Math.max(endCol, col + 1) };
  }
}

export function formatDiagnostic(d: Diagnostic, lang: Lang = "it", file?: string): string {
  const where = `${file ? file + ":" : ""}${d.line}:${d.col}`;
  const kind = d.severity === "error" ? (lang === "it" ? "errore" : "error") : (lang === "it" ? "avviso" : "warning");
  return `${where}: ${kind}: ${message(d.code, d.args, lang)}`;
}
