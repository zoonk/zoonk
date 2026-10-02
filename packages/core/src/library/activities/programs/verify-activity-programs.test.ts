import { activityContentFixtures as fixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { type ActivityStepContent, activityContentSchema } from "../activity-templates";
import { verifyActivityPrograms } from "./verify-activity-programs";

/** Pyodide loads in a couple of seconds on the first Python run. */
const PYTHON_TEST_TIMEOUT_MS = 30_000;

function content(value: object): ActivityStepContent {
  return activityContentSchema.parse(value);
}

function withFields<TFixture extends { fields: object }>(fixture: TFixture, fields: object) {
  return content({ ...fixture, fields: { ...fixture.fields, ...fields } });
}

const javascriptRunner = withFields(fixtures.codeRunner, {
  expectedOutput: "[ 2, 4, 6 ]",
  language: "javascript",
  mistakes: [],
  solution:
    "const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n * 2);\nconsole.log(doubled);",
  starterCode:
    "const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n);\nconsole.log(doubled);",
});

const pythonTracer = withFields(fixtures.codeTracer, {
  code: "total = 0\nfor n in [2, 3]:\n    total += n\nprint(total)",
  language: "python",
  pauses: [
    {
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "5" },
      ],
      question: "What's the total after the second pass?",
      step: 2,
      variable: "total",
    },
  ],
  trace: [
    { line: 1, values: [{ name: "total", value: 0 }] },
    {
      line: 3,
      values: [
        { name: "n", value: 2 },
        { name: "total", value: 2 },
      ],
    },
    {
      line: 3,
      values: [
        { name: "n", value: 3 },
        { name: "total", value: 5 },
      ],
    },
  ],
  watch: ["total", "n"],
});

describe(verifyActivityPrograms, () => {
  it("passes code activities whose answers match real runs, and skips other templates", async () => {
    await expect(
      verifyActivityPrograms([
        content(fixtures.codeTracer),
        content(fixtures.sqlPlayground),
        javascriptRunner,
        content(fixtures.timeline),
      ]),
    ).resolves.toStrictEqual([[], [], [], []]);
  });

  it(
    "passes Python programs and traces that match their runs",
    async () => {
      await expect(
        verifyActivityPrograms([content(fixtures.codeRunner), pythonTracer]),
      ).resolves.toStrictEqual([[], []]);
    },
    PYTHON_TEST_TIMEOUT_MS,
  );

  it("holds back a code runner whose expected output isn't what the solution prints", async () => {
    const [issues] = await verifyActivityPrograms([
      withFields(javascriptRunner, { expectedOutput: "[2, 4, 6]" }),
    ]);

    expect(issues).toStrictEqual([
      {
        code: "answerMismatch",
        message:
          'The solution prints "[ 2, 4, 6 ]\\n"; the expected output must be exactly what it prints',
        path: "fields.expectedOutput",
      },
    ]);
  });

  it("holds back a code runner whose solution fails or whose starter code already works", async () => {
    const [failing, alreadyRight] = await verifyActivityPrograms([
      withFields(javascriptRunner, {
        solution:
          "const numbers = [1, 2, 3];\nconst doubled = numbers.mapp((n) => n * 2);\nconsole.log(doubled);",
      }),
      withFields(javascriptRunner, {
        starterCode:
          "const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n + n);\nconsole.log(doubled);",
      }),
    ]);

    expect(failing).toStrictEqual([
      expect.objectContaining({ code: "programFails", path: "fields.solution" }),
    ]);

    expect(failing?.[0]?.message).toMatch(/^The solution fails on line 2: TypeError/u);

    expect(alreadyRight).toStrictEqual([
      expect.objectContaining({ code: "missingInteraction", path: "fields.starterCode" }),
    ]);
  });

  it("points at the first trace step a real run doesn't reach with those values", async () => {
    const wrongValue = structuredClone(fixtures.codeTracer);

    wrongValue.fields.trace[2] = {
      line: 3,
      values: [
        { name: "lo", value: 4 },
        { name: "mid", value: 4 },
      ],
    };

    const staleValue = structuredClone(fixtures.codeTracer);
    staleValue.fields.code = staleValue.fields.code.replace("hi = 7", "hi = 9");

    const [wrong, stale] = await verifyActivityPrograms([content(wrongValue), content(staleValue)]);

    expect(wrong).toStrictEqual([
      {
        code: "answerMismatch",
        message: "Step 3 is line 3 and shows mid = 4, but running the code, it's 5 there",
        path: "fields.trace.2",
      },
    ]);

    expect(stale).toStrictEqual([
      expect.objectContaining({ code: "answerMismatch", path: "fields.trace.0" }),
    ]);
  });

  it(
    "holds back a trace for code that loops without end",
    async () => {
      const [issues] = await verifyActivityPrograms([
        withFields(pythonTracer, {
          code: "total = 0\nfor n in [2, 3]:\n    total += n\nwhile True:\n    pass",
        }),
      ]);

      expect(issues).toStrictEqual([
        {
          code: "programFails",
          message: "The code runs more than 1000 lines; trace a shorter program",
          path: "fields.code",
        },
      ]);
    },
    PYTHON_TEST_TIMEOUT_MS,
  );

  it("holds back a SQL solution that fails or returns other rows than expected", async () => {
    const rounded = structuredClone(fixtures.sqlPlayground);

    rounded.fields.solution =
      "SELECT name, pop_millions / 1000.0 AS pop_millions FROM countries WHERE continent = 'Asia' AND pop_millions > 200 ORDER BY pop_millions DESC;";

    const [wrongRows, failing] = await verifyActivityPrograms([
      content(rounded),
      withFields(fixtures.sqlPlayground, { solution: "SELECT name FROM nowhere;" }),
    ]);

    expect(wrongRows).toStrictEqual([
      {
        code: "answerMismatch",
        message:
          'The solution returns columns ["name","pop_millions"] and rows [["India",1.451],["China",1.419],["Indonesia",0.283]]; the expected result must match it exactly',
        path: "fields.expected",
      },
    ]);

    expect(failing).toStrictEqual([
      {
        code: "programFails",
        message: "The solution query fails: no such table: nowhere",
        path: "fields.solution",
      },
    ]);
  });
});
