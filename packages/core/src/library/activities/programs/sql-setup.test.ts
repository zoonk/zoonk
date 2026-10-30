import { describe, expect, it } from "vitest";
import { MAX_PROGRAM_OUTPUT_LENGTH } from "./program-limits";
import { sqlSetupStatements, toSqlCell } from "./sql-setup";

describe(sqlSetupStatements, () => {
  it("creates each table with typed, quoted columns and inserts rows as parameters", () => {
    const statements = sqlSetupStatements([
      {
        columns: [
          { name: "name", type: "text" },
          { name: "order", type: "integer" },
          { name: "share", type: "real" },
        ],
        name: "countries",
        rows: [
          ["Côte d'Ivoire", 1, 0.5],
          ["Brazil", 2, null],
        ],
      },
    ]);

    expect(statements).toStrictEqual([
      { params: [], sql: 'CREATE TABLE "countries" ("name" TEXT, "order" INTEGER, "share" REAL);' },
      { params: ["Côte d'Ivoire", 1, 0.5], sql: 'INSERT INTO "countries" VALUES (?, ?, ?);' },
      { params: ["Brazil", 2, null], sql: 'INSERT INTO "countries" VALUES (?, ?, ?);' },
    ]);
  });
});

describe(toSqlCell, () => {
  it("keeps a long text cell to a program's output limit", () => {
    expect(toSqlCell("x".repeat(MAX_PROGRAM_OUTPUT_LENGTH * 2))).toHaveLength(
      MAX_PROGRAM_OUTPUT_LENGTH,
    );
  });
});
