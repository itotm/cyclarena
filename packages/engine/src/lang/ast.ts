// Syntax tree of the paintarena language.

export interface Pos { line: number; col: number; end: number }

export type Expr =
  | { k: "num"; v: number; pos: Pos }
  | { k: "name"; name: string; pos: Pos }
  | { k: "index"; name: string; index: Expr; pos: Pos }
  | { k: "call"; name: string; args: Expr[]; pos: Pos }
  | { k: "str"; s: string; pos: Pos }
  | { k: "un"; op: string; e: Expr; pos: Pos }
  | { k: "bin"; op: string; l: Expr; r: Expr; pos: Pos };

export interface Target { name: string; index?: Expr; pos: Pos }

export type Stmt =
  | { k: "var"; name: string; size?: Expr; init?: Expr; pos: Pos }
  | { k: "assign"; target: Target; op: string; value: Expr; pos: Pos }
  | { k: "incdec"; target: Target; op: "++" | "--"; pos: Pos }
  | { k: "call"; call: Extract<Expr, { k: "call" }>; pos: Pos }
  | { k: "if"; cond: Expr; then: Stmt[]; else?: Stmt[]; pos: Pos }
  | { k: "while"; cond: Expr; body: Stmt[]; pos: Pos }
  | { k: "loop"; body: Stmt[]; pos: Pos }
  | { k: "for"; init?: Stmt; cond?: Expr; step?: Stmt; body: Stmt[]; pos: Pos }
  | { k: "break"; pos: Pos }
  | { k: "continue"; pos: Pos }
  | { k: "return"; value?: Expr; pos: Pos }
  | { k: "block"; body: Stmt[]; pos: Pos };

export type TopDecl =
  | { k: "const"; name: string; value: Expr; pos: Pos }
  | { k: "var"; name: string; size?: Expr; init?: Expr; pos: Pos }
  | { k: "fn"; name: string; params: { name: string; pos: Pos }[]; body: Stmt[]; pos: Pos; endLine: number };
