import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type ChangedFile } from "./diff-audit.mts";
import { auditDuplicatedDefinitions } from "./duplication.mts";

const EPSILON_COPIES = 13;
const STAND_IN_COPIES = 6;
const HELPER_BODY_LINE = 4;
const HELPER_END_LINE = 5;

const PATH = "packages/core/src/plans/current.ts";

function audit(sources: Record<string, string>, changedLines?: number[]) {
  const source = sources[PATH] ?? "";

  const file: ChangedFile = {
    added: (changedLines ?? source.split("\n").map((_, index) => index + 1)).map((line) => ({
      line,
      text: source.split("\n")[line - 1] ?? "",
    })),
    created: false,
    path: PATH,
  };

  return auditDuplicatedDefinitions([file], Object.keys(sources), (path) => sources[path] ?? "");
}

function copies(name: string, count: number, declaration: string): Record<string, string> {
  return Object.fromEntries<string>([
    [PATH, declaration],
    ...Array.from({ length: count - 1 }, (_, index): [string, string] => [
      `packages/core/src/plans/${name}-${index}.ts`,
      declaration,
    ]),
  ]);
}

describe("reviewing duplicated definitions", () => {
  it.each([
    ["EPSILON", EPSILON_COPIES, "const EPSILON = 1e-6;"],
    ["LEARN_KINDS", 10, 'const LEARN_KINDS = new Set(["chapter", "lesson"]);'],
    [
      "isStandIn",
      STAND_IN_COPIES,
      "function isStandIn(item: Item) { return item.kind === 'standIn'; }",
    ],
  ])("lists all %s definitions when one changes", (name, count, declaration) => {
    const flags = audit(copies(name, count, declaration));

    assert.equal(flags.length, 1);
    assert.match(flags[0]?.rule.question ?? "", new RegExp(`${count} definitions`, "u"));
    assert.ok(flags[0]?.rule.question.includes(`${name}-${count - 2}.ts:1`));
    assert.equal(flags[0]?.rule.blocks, undefined);
  });

  it("shows differing values so a change cannot silently drift from another definition", () => {
    const flags = audit({
      [PATH]: "export const HELP_LIMIT = 3;",
      "apps/api/src/help/route.ts": "const HELP_LIMIT = 2;",
    });

    assert.match(flags[0]?.rule.question ?? "", /HELP_LIMIT = 3/u);
    assert.match(flags[0]?.rule.question ?? "", /HELP_LIMIT = 2/u);
  });

  it("finds initializer-only and helper-body edits, including arrow helpers", () => {
    const sources = {
      [PATH]: [
        "const LIMIT =",
        "  3;",
        "const isStandIn = (item: Item) => {",
        "  return item.placeholder;",
        "};",
      ].join("\n"),
      "packages/core/src/plans/other.ts":
        "const LIMIT = 2; function isStandIn(item: Item) { return item.placeholder; }",
    };

    assert.deepEqual(
      audit(sources, [2, HELPER_BODY_LINE]).map((flag) => flag.lines),
      [[1], [3]],
    );

    assert.deepEqual(
      audit(sources, [HELPER_END_LINE]).map((flag) => flag.lines),
      [[3]],
    );
  });

  it("ignores imports, usages, local variables, tests, generated source and unchanged definitions", () => {
    assert.deepEqual(
      audit(
        {
          [PATH]: "const LIMIT = 3;\nexport const title = 'Plan';",
          "packages/core/src/generated/client.ts": "const LIMIT = 2;",
          "packages/core/src/plans/current.test.ts": "const LIMIT = 2;",
          "packages/core/src/plans/other.ts":
            "import { LIMIT } from './current'; function load() { const LIMIT = 2; return LIMIT; }",
        },
        [2],
      ),
      [],
    );

    assert.deepEqual(
      audit({
        [PATH]: "const LIMIT = 3;",
        "packages/core/src/generated/client.ts": "const LIMIT = 2;",
        "packages/core/src/plans/current.test.ts": "const LIMIT = 2;",
        "packages/core/src/plans/other.ts":
          "import { LIMIT } from './current'; function load() { const LIMIT = 2; return LIMIT; }",
      }),
      [],
    );
  });

  it("reports one review item per name even when several copies change", () => {
    const sources = copies("EPSILON", EPSILON_COPIES, "const EPSILON = 1e-6;");

    const files = Object.keys(sources).map((path): ChangedFile => ({
      added: [{ line: 1, text: sources[path] ?? "" }],
      created: false,
      path,
    }));

    assert.equal(
      auditDuplicatedDefinitions(files, Object.keys(sources), (path) => sources[path] ?? "").length,
      1,
    );
  });

  it("leaves framework handlers and React components out of helper-name searches", () => {
    assert.deepEqual(
      audit({
        [PATH]: "export function GET() {} export function Page() {}",
        "apps/api/src/example/route.ts": "export function GET() {} export function Page() {}",
      }),
      [],
    );
  });

  it("does not conflate different names whose numeric values happen to match", () => {
    assert.deepEqual(
      audit({
        [PATH]: "const HELP_LIMIT = 3;",
        "packages/core/src/plans/other.ts": "const MAX_RETRIES = 3;",
      }),
      [],
    );
  });

  it("does not report old duplication when only a usage changes", () => {
    assert.deepEqual(
      audit(
        {
          ...copies("EPSILON", EPSILON_COPIES, "const EPSILON = 1e-6;"),
          [PATH]: "const EPSILON = 1e-6;\nexport const total = 1 + EPSILON;",
        },
        [2],
      ),
      [],
    );
  });
});
