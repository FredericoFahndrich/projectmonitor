import { test } from "node:test";
import assert from "node:assert/strict";
import { csv, csvCell, charterTxt, projectJson } from "../src/exports/index.js";
import { cents } from "../src/utils/format.js";
test("CSV português: BOM, delimitador, aspas, acentos e fórmulas", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  for (const v of ["=SUM(A1)", "  +1", "-2", "@cmd", "\t=1"])
    assert.ok(csvCell(v).startsWith("\"'"));
  const out = csv("costs", [
    {
      category: "Operação",
      description: 'A;B\n"C"',
      planned_cents: 12345,
      actual_cents: 1,
    },
  ]);
  assert.ok(out.startsWith("\uFEFF"));
  assert.ok(out.includes('"123,45"'));
  assert.ok(out.includes("Operação"));
  assert.ok(out.includes('A;B\n""C""'));
});
test("TXT e JSON contêm dados reais e relações", () => {
  assert.ok(
    charterTxt({ name: "Solar" }, { objective: "Entregar" }).includes(
      "Entregar",
    ),
  );
  const data = {
    schema_version: 1,
    project: { id: "p" },
    tasks: [{ project_id: "p" }],
  };
  assert.deepEqual(JSON.parse(projectJson(data)), data);
});
test("dinheiro convertido por dígitos inteiros", () => {
  assert.equal(cents("0,29"), 29);
  assert.equal(cents("100.01"), 10001);
  assert.throws(() => cents("1.001"));
  assert.throws(() => cents("-1"));
});
