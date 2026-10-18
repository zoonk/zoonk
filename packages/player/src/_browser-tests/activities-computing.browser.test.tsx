import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  checkActivity,
  expectCount,
  expectVerdict,
  focusOn,
  openActivity,
  press,
} from "../_test-utils/activity-player";

/** Pyodide downloads from the CDN on first use in each fresh browser page. */
const PYTHON_TIMEOUT_MS = 60_000;

const javascriptRunner = {
  ...activityContentFixtures.codeRunner,
  fields: {
    editableLines: [2],
    expectedOutput: "[ 2, 4, 6 ]",
    language: "javascript",
    mistakes: [{ feedback: "map returns a new array.", output: "[ 1, 2, 3 ]" }],
    solution:
      "const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n * 2);\nconsole.log(doubled);",
    starterCode:
      "const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n);\nconsole.log(doubled);",
  },
  prompt: "Double every number.",
};

const formulaTester = {
  ...activityContentFixtures.patternTester,
  fields: {
    examples: [
      {
        inputs: [
          { name: "A1", value: 100 },
          { name: "B1", value: 0.2 },
        ],
        output: 120,
      },
      {
        inputs: [
          { name: "A1", value: 50 },
          { name: "B1", value: 0.1 },
        ],
        output: 55,
      },
    ],
    hints: [{ hint: "Add the increase to the price.", mistake: "Only the increase" }],
    mode: "formula",
    solution: "A1*(1+B1)",
    task: "Price A1 goes up by rate B1. What's the new price?",
    tolerance: { kind: "absolute", value: 0.01 },
  },
};

function editableLine(line: number) {
  return page.getByRole("textbox", { name: `Line ${line}, yours to edit` });
}

async function stepForward(times: number) {
  for (const _ of Array.from({ length: times })) {
    // oxlint-disable-next-line no-await-in-loop -- Each press runs one more step.
    await page.getByRole("button", { name: "Step forward" }).click();
  }
}

describe("computing activities", () => {
  it(
    "code runner: fixing the loop in Python prints the expected output",
    { timeout: PYTHON_TIMEOUT_MS },
    async () => {
      openActivity({ template: "codeRunner" });
      await page.getByRole("button", { name: "Run" }).click();

      await expect
        .element(page.getByText("range stops before its end."), { timeout: PYTHON_TIMEOUT_MS })
        .toBeVisible();

      await editableLine(2).fill("for n in range(1, 101):");

      await expect
        .element(page.getByText("You changed the code. Run it again to see the new output."))
        .toBeVisible();

      await expect.element(page.getByRole("button", { name: "Check" })).toBeDisabled();
      await page.getByRole("button", { name: "Run again" }).click();
      await expectCount(page.getByText("5050", { exact: true }), 2);
      await checkActivity();
      await expectVerdict("Correct!");
    },
  );

  it("code runner: JavaScript output that differs is wrong", async () => {
    openActivity({ content: javascriptRunner, template: "codeRunner" });
    await page.getByRole("button", { name: "Run" }).click();
    await expect.element(page.getByText("map returns a new array.")).toBeVisible();
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("code tracer: predicting the traced value is right", async () => {
    openActivity({ template: "codeTracer" });
    await expect.element(page.getByText("Step 1 of 4", { exact: true })).toBeVisible();
    await stepForward(2);
    await expect.element(page.getByText("What will mid be on pass 3?")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Step forward" })).toBeDisabled();
    await page.getByRole("button", { exact: true, name: "6" }).click();
    await stepForward(1);
    await expect.element(page.getByText("You said 6, and it was.")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("code tracer: a wrong prediction shows the traced value", async () => {
    openActivity({ template: "codeTracer" });
    await stepForward(2);
    await page.getByRole("button", { exact: true, name: "5" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("You said 5; it was 6.")).toBeVisible();
  });

  it("SQL playground: the right query returns the expected rows", async () => {
    openActivity({ template: "sqlPlayground" });

    await page
      .getByRole("textbox", { name: "Your query" })
      .fill(activityContentFixtures.sqlPlayground.fields.solution);

    await page.getByRole("button", { name: "Run" }).click();
    await expect.element(page.getByText("Your result: 3 rows")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("A query that works")).toBeVisible();
  });

  it("SQL playground: OR instead of AND shows the expected rows", async () => {
    openActivity({ template: "sqlPlayground" });

    await page
      .getByRole("textbox", { name: "Your query" })
      .fill(
        "SELECT name, pop_millions FROM countries WHERE continent = 'Asia' OR pop_millions > 200 ORDER BY pop_millions DESC;",
      );

    await page.getByRole("button", { name: "Run" }).click();
    await expect.element(page.getByText("Your result: 4 rows")).toBeVisible();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Expected result, in this order")).toBeVisible();
    await expect.element(page.getByText("OR keeps rows that pass either test.")).toBeVisible();
  });

  it("pattern tester: examples pass as the pattern grows", async () => {
    openActivity({ template: "patternTester" });
    const pattern = page.getByRole("textbox", { name: "Your pattern" });
    await pattern.fill(String.raw`^\d{5}`);

    await expect
      .element(page.getByRole("region", { name: "Should not match" }))
      .toMatchTextContent("1 of 3 pass");

    await pattern.fill(String.raw`^\d{5}(-\d{4})?$`);

    await expect
      .element(page.getByRole("region", { name: "Should not match" }))
      .toMatchTextContent("3 of 3 pass");

    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("A pattern that works")).toBeVisible();
  });

  it("pattern tester: a formula is checked cell by cell", async () => {
    openActivity({ content: formulaTester, template: "patternTester" });
    await page.getByRole("button", { name: "Show a hint" }).click();
    await expect.element(page.getByText("Add the increase to the price.")).toBeVisible();
    await page.getByRole("textbox", { name: "Your formula" }).fill("=A1*B1");
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("A formula that works")).toBeVisible();
  });
});

describe("computing activities with a keyboard or a runaway program", () => {
  it("pattern tester: Enter on a symbol button types it at the cursor", async () => {
    openActivity({ template: "patternTester" });
    const pattern = page.getByRole("textbox", { name: "Your pattern" });
    await focusOn(pattern);
    await focusOn(page.getByRole("button", { name: "Start of the text" }));
    await press("Enter");
    await expect.element(pattern).toHaveValue("^");
    await focusOn(page.getByRole("button", { name: "Any digit" }));
    await press("Enter");
    await expect.element(pattern).toHaveValue(String.raw`^\d`);
    await expect.element(pattern).toHaveFocus();
    // `{{` types a literal `{`: a single one starts a key name in userEvent's syntax.
    await userEvent.keyboard(String.raw`{{5}(-\d{{4})?$`);

    await expect
      .element(page.getByRole("region", { name: "Should match" }))
      .toMatchTextContent("2 of 2 pass");

    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("code runner: an endless loop stops at the time limit", async () => {
    const endless = {
      ...javascriptRunner,
      fields: {
        ...javascriptRunner.fields,
        starterCode: 'let n = 0;\nwhile (true) { n += 1; }\nconsole.log("counted to " + n);',
      },
    };

    openActivity({ content: endless, template: "codeRunner" });
    await page.getByRole("button", { name: "Run" }).click();

    await expect
      .element(page.getByText("Stopped after 3 seconds. Is there a loop that never ends?"))
      .toBeVisible();

    await editableLine(2).fill("while (n < 3) { n += 1; }");
    await focusOn(editableLine(2));
    await press("Enter");
    await expect.element(page.getByText("counted to 3", { exact: true })).toBeVisible();
  });
});
