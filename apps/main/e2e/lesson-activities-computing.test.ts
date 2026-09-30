import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { checkActivity, expectVerdict, openActivity } from "./activity-lesson";
import { type Page, expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

/** Pyodide downloads from the CDN on first use in each fresh browser context. */
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

function editableLine(page: Page, line: number) {
  return page.getByRole("textbox", { name: `Line ${line}, yours to edit` });
}

async function stepForward(page: Page, times: number) {
  for (const _ of Array.from({ length: times })) {
    // oxlint-disable-next-line no-await-in-loop -- Each press runs one more step.
    await page.getByRole("button", { name: "Step forward" }).click();
  }
}

for (const mode of MODES) {
  test.describe(`computing activities in ${mode} mode`, () => {
    test("code runner: fixing the loop in Python prints the expected output", async ({ page }) => {
      await openActivity(page, { mode, template: "codeRunner" });
      await page.getByRole("button", { name: "Run" }).click();

      await expect(page.getByText("range stops before its end.")).toBeVisible({
        timeout: PYTHON_TIMEOUT_MS,
      });

      await editableLine(page, 2).fill("for n in range(1, 101):");

      await expect(
        page.getByText("You changed the code. Run it again to see the new output."),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Check" })).toBeDisabled();
      await page.getByRole("button", { name: "Run again" }).click();
      await expect(page.getByText("5050", { exact: true })).toHaveCount(2);
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("code runner: JavaScript output that differs is wrong", async ({ page }) => {
      await openActivity(page, { content: javascriptRunner, mode, template: "codeRunner" });
      await page.getByRole("button", { name: "Run" }).click();
      await expect(page.getByText("map returns a new array.")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("code tracer: predicting the traced value is right", async ({ page }) => {
      await openActivity(page, { mode, template: "codeTracer" });
      await expect(page.getByText("Step 1 of 4", { exact: true })).toBeVisible();
      await stepForward(page, 2);
      await expect(page.getByText("What will mid be on pass 3?")).toBeVisible();
      await expect(page.getByRole("button", { name: "Step forward" })).toBeDisabled();
      await page.getByRole("button", { exact: true, name: "6" }).click();
      await stepForward(page, 1);
      await expect(page.getByText("You said 6, and it was.")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("code tracer: a wrong prediction shows the traced value", async ({ page }) => {
      await openActivity(page, { mode, template: "codeTracer" });
      await stepForward(page, 2);
      await page.getByRole("button", { exact: true, name: "5" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("You said 5; it was 6.")).toBeVisible();
    });

    test("SQL playground: the right query returns the expected rows", async ({ page }) => {
      await openActivity(page, { mode, template: "sqlPlayground" });

      await page
        .getByRole("textbox", { name: "Your query" })
        .fill(activityContentFixtures.sqlPlayground.fields.solution);

      await page.getByRole("button", { name: "Run" }).click();
      await expect(page.getByText("Your result: 3 rows")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("A query that works")).toBeVisible();
    });

    test("SQL playground: OR instead of AND shows the expected rows", async ({ page }) => {
      await openActivity(page, { mode, template: "sqlPlayground" });

      await page
        .getByRole("textbox", { name: "Your query" })
        .fill(
          "SELECT name, pop_millions FROM countries WHERE continent = 'Asia' OR pop_millions > 200 ORDER BY pop_millions DESC;",
        );

      await page.getByRole("button", { name: "Run" }).click();
      await expect(page.getByText("Your result: 4 rows")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Expected result, in this order")).toBeVisible();
      await expect(page.getByText("OR keeps rows that pass either test.")).toBeVisible();
    });

    test("pattern tester: examples pass as the pattern grows", async ({ page }) => {
      await openActivity(page, { mode, template: "patternTester" });
      const pattern = page.getByRole("textbox", { name: "Your pattern" });
      await pattern.fill(String.raw`^\d{5}`);

      await expect(page.getByRole("region", { name: "Should not match" })).toContainText(
        "1 of 3 pass",
      );

      await pattern.fill(String.raw`^\d{5}(-\d{4})?$`);

      await expect(page.getByRole("region", { name: "Should not match" })).toContainText(
        "3 of 3 pass",
      );

      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("A pattern that works")).toBeVisible();
    });

    test("pattern tester: a formula is checked cell by cell", async ({ page }) => {
      await openActivity(page, { content: formulaTester, mode, template: "patternTester" });
      await page.getByRole("button", { name: "Show a hint" }).click();
      await expect(page.getByText("Add the increase to the price.")).toBeVisible();
      await page.getByRole("textbox", { name: "Your formula" }).fill("=A1*B1");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("A formula that works")).toBeVisible();
    });
  });
}

test.describe("computing activities with a keyboard or a runaway program", () => {
  test("pattern tester: Enter on a symbol button types it at the cursor", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "patternTester" });
    const pattern = page.getByRole("textbox", { name: "Your pattern" });
    await pattern.focus();
    await page.getByRole("button", { name: "Start of the text" }).press("Enter");
    await expect(pattern).toHaveValue("^");
    await page.getByRole("button", { name: "Any digit" }).press("Enter");
    await expect(pattern).toHaveValue(String.raw`^\d`);
    await expect(pattern).toBeFocused();
    await page.keyboard.type(String.raw`{5}(-\d{4})?$`);
    await expect(page.getByRole("region", { name: "Should match" })).toContainText("2 of 2 pass");
    await page.getByRole("button", { name: "Check" }).press("Enter");
    await expectVerdict(page, "Correct!");
  });

  test("code runner: an endless loop stops at the time limit", async ({ page }) => {
    const endless = {
      ...javascriptRunner,
      fields: {
        ...javascriptRunner.fields,
        starterCode: 'let n = 0;\nwhile (true) { n += 1; }\nconsole.log("counted to " + n);',
      },
    };

    await openActivity(page, { content: endless, mode: "focus", template: "codeRunner" });
    await page.getByRole("button", { name: "Run" }).click();

    await expect(
      page.getByText("Stopped after 3 seconds. Is there a loop that never ends?"),
    ).toBeVisible();

    await editableLine(page, 2).fill("while (n < 3) { n += 1; }");
    await editableLine(page, 2).press("Enter");
    await expect(page.getByText("counted to 3", { exact: true })).toBeVisible();
  });
});
