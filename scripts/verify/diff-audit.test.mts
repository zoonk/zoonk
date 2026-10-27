import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type ChangedFile, auditDiff, parseDiff, renderAudit } from "./diff-audit.mts";

/** Built at runtime, so this file never holds a credential or a focused test the audit would flag. */
const LIVE_KEY = ["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_");
const FOCUSED = ["it", "only"].join(".");
const FOCUSED_EACH = ["it", "only", "each"].join(".");

function file(path: string, lines: string[], created = false): ChangedFile {
  return { added: lines.map((text, index) => ({ line: index + 1, text })), created, path };
}

function names(files: ChangedFile[], client: string[] = []) {
  return auditDiff(files, (path) => client.includes(path)).map(
    (flag) => `${flag.rule.name} ${flag.lines.join(",")}`,
  );
}

describe("reading a diff", () => {
  it("numbers each added line and marks new files", () => {
    const diff = [
      "diff --git a/apps/main/src/a.tsx b/apps/main/src/a.tsx",
      "--- a/apps/main/src/a.tsx",
      "+++ b/apps/main/src/a.tsx",
      "@@ -10,0 +11,2 @@ export function A() {",
      "+  useEffect(() => {",
      "+++ an added line that starts with two plus signs",
      "diff --git a/apps/main/src/b/route.ts b/apps/main/src/b/route.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/apps/main/src/b/route.ts",
      "@@ -0,0 +1 @@",
      "+export async function GET() {}",
    ].join("\n");

    assert.deepEqual(parseDiff(diff), [
      {
        added: [
          { line: 11, text: "  useEffect(() => {" },
          { line: 12, text: "++ an added line that starts with two plus signs" },
        ],
        created: false,
        path: "apps/main/src/a.tsx",
      },
      {
        added: [{ line: 1, text: "export async function GET() {}" }],
        created: true,
        path: "apps/main/src/b/route.ts",
      },
    ]);
  });
});

describe("questioning a diff", () => {
  it("asks about effects, and about browser fetches only in client files", () => {
    const lines = ['"use client";', "useEffect(() => {", "  fetch(`/api/goals`).then(setGoals);"];

    assert.deepEqual(names([file("apps/main/src/goals.tsx", lines)], ["apps/main/src/goals.tsx"]), [
      "Client component 1",
      "Effect 2",
      "Data fetched in the browser 3",
    ]);

    assert.ok(
      !names([file("apps/main/src/goals.tsx", lines)]).includes("Data fetched in the browser 3"),
    );
  });

  it("blocks credentials and focused tests, and asks about new entry points", () => {
    const flags = auditDiff(
      [
        file("apps/main/src/config.ts", [`const key = "${LIVE_KEY}";`]),
        file("apps/main/src/x.test.ts", [`${FOCUSED}("works", () => {});`]),
        file("apps/main/src/y.test.ts", [`${FOCUSED_EACH}([1, 2])("works with %i", () => {});`]),
        file("apps/main/src/app/api/x/route.ts", ["export async function POST() {}"], true),
      ],
      () => false,
    );

    assert.deepEqual(
      flags.map((flag) => `${flag.rule.name}${flag.rule.blocks ? " (blocks)" : ""}`),
      ["Secret (blocks)", "Focused test (blocks)", "Focused test (blocks)", "Route handler"],
    );

    assert.match(
      renderAudit(flags).join("\n"),
      /\*\*must fix\*\* \*\*Secret\*\*: apps\/main\/src\/config\.ts:1/u,
    );
  });

  it("asks about work per item on the server and actions not pinned to a commit", () => {
    const loop = file("packages/core/src/goals/x.ts", [
      "await Promise.all(ids.map(async (id) => {",
    ]);

    const sha = "3d3c42e5aac5ba805825da76410c181273ba90b1";

    const workflow = file(".github/workflows/ci.yml", [
      `      - uses: actions/checkout@${sha} # v7`,
      "      - uses: actions/setup-node@v6",
    ]);

    assert.deepEqual(names([loop, workflow]), ["Work per item 1", "Unpinned action 2"]);
  });

  it("asks whether a migration is safe on production data", () => {
    const migration = file("packages/db/src/prisma/migrations/1_x/migration.sql", [
      'ALTER TABLE "goal" ADD COLUMN "focus" TEXT NOT NULL;',
      'CREATE INDEX "goal_focus_idx" ON "goal"("focus");',
      'ALTER TABLE "goal" ADD COLUMN "note" TEXT;',
    ]);

    assert.deepEqual(names([migration]), ["Migration 1,2"]);
  });
});
