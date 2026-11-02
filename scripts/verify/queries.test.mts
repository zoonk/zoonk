import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import {
  filteredScans,
  label,
  queryFindings,
  readStatements,
  summarizeStatements,
} from "./queries.mts";

const GOALS =
  'SELECT "public"."Goal"."id" FROM "public"."Goal" WHERE "public"."Goal"."userId" = $1';

const ITEM =
  'SELECT "public"."PlanItem"."id" FROM "public"."PlanItem" WHERE "public"."PlanItem"."id" = $1';

const INSIDE = { at: 1500 };

function statement(sql: string, overrides: { at?: number; rows?: number } = {}) {
  return { at: overrides.at ?? 1000, ms: 2, rows: overrides.rows ?? 1, sql };
}

describe("a render's database work", () => {
  it("reads only the statements that started inside the window", () => {
    const directory = mkdtempSync(join(tmpdir(), "zoonk-queries-"));
    const file = join(directory, "queries.jsonl");

    try {
      const lines = [
        statement(GOALS, { at: 900 }),
        statement(GOALS, INSIDE),
        statement(ITEM, { at: 2500 }),
      ];

      writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);

      assert.deepEqual(
        readStatements(file, { from: 1000, to: 2000 }).map((found) => found.at),
        [INSIDE.at],
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("asks about a read repeated per item and a result too large to show", () => {
    const statements = [
      statement(GOALS, { rows: 4000 }),
      statement(ITEM),
      statement(ITEM),
      statement(ITEM),
      statement("COMMIT"),
    ];

    const summary = summarizeStatements(statements);

    assert.equal(summary.count, statements.length);
    assert.deepEqual(summary.reads, [GOALS, ITEM]);

    assert.deepEqual(
      queryFindings(summary).map((finding) => `${finding.check} ${finding.value}`),
      ["repeated query 3", "large result 4000"],
    );
  });

  it("names a statement by its tables, without the schema's quoting", () => {
    assert.equal(label(GOALS), "SELECT Goal.id FROM Goal WHERE Goal.userId = $1");
  });
});

describe("a read's plan with sequential scans off", () => {
  it("finds the filters no index serves, at any depth", () => {
    const plan = {
      "Node Type": "Nested Loop",
      Plans: [
        { "Node Type": "Index Scan", "Relation Name": "Goal" },
        { Filter: "(status = $2)", "Node Type": "Seq Scan", "Relation Name": "PlanItem" },
        { "Node Type": "Seq Scan", "Relation Name": "Organization" },
      ],
    };

    assert.deepEqual(filteredScans(plan), [{ filter: "(status = $2)", table: "PlanItem" }]);
  });
});
