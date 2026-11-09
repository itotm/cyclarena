// Program scan used by the editor's completion and hints.

import { test } from "node:test";
import assert from "node:assert/strict";
import { scanProgram } from "../src/lib/paide.ts";

const SRC = `const STEP = 20;
var dir = 0;
var seen[8];   // "var fake" in a comment
fn aim(center, width) {
  var a = center;
  if (a > 0) {
    var inner = 1;
  }
  @A
  return a;
}
fn main() {
  var d = scan(dir, 10);
  @B
}
@C`;

function at(marker: string) {
  const pos = SRC.indexOf(marker);
  return scanProgram(SRC.replace(/@[ABC]/g, "  "), pos);
}

test("editor: program symbols and visibility of local variables", () => {
  const a = at("@A");
  assert.deepEqual(a.top.map((s) => `${s.kind}:${s.name}`), ["const:STEP", "global:dir", "global:seen", "fn:aim", "fn:main"]);
  assert.deepEqual(a.top.find((s) => s.name === "aim")!.params, ["center", "width"]);
  assert.equal(a.top.find((s) => s.name === "seen")!.size, "8");
  // `inner` is in a block that is already closed: no longer visible
  assert.deepEqual(a.locals.map((s) => s.name), ["center", "width", "a"]);
  assert.deepEqual(at("@B").locals.map((s) => s.name), ["d"]);
  assert.deepEqual(at("@C").locals, []);
  assert.equal(a.inText, false);
  // inside a comment or a string
  assert.equal(scanProgram(SRC, SRC.indexOf("fake")).inText, true);
  assert.equal(scanProgram('fn main() { print("hello world"); }', 22).inText, true);
});

test("editor: { … } blocks can be folded", async () => {
  const { EditorState } = await import("@codemirror/state");
  const { foldable, ensureSyntaxTree } = await import("@codemirror/language");
  const { paLanguage } = await import("../src/lib/palang.ts");
  const { paIde } = await import("../src/lib/paide.ts");
  const st = EditorState.create({ doc: "fn main() { // starts\n  loop {\n    x();\n  }\n}\n", extensions: [paLanguage, paIde()] });
  ensureSyntaxTree(st, st.doc.length, 1000);
  const f = (l: number) => foldable(st, st.doc.line(l).from, st.doc.line(l).to);
  assert.deepEqual(f(1), { from: 11, to: 44 });
  assert.deepEqual(f(2), { from: 30, to: 42 });
  assert.equal(f(3), null);
});
