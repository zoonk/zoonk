import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { type Page, expect, test } from "./fixtures";

test("requires a code before a learner can approve or deny a device login", async ({
  userWithoutProgress: page,
}) => {
  await page.goto("/device");

  const code = page.getByRole("textbox", { name: "Code from your terminal" });
  const approve = page.getByRole("button", { name: "Approve" });
  const deny = page.getByRole("button", { name: "Deny" });

  await expectHydrated(code);
  await expect(approve).toBeDisabled();
  await expect(deny).toBeDisabled();

  await code.fill("ABCD2345");
  await expect(approve).toBeEnabled();
  await expect(deny).toBeEnabled();

  await code.fill(" ");
  await expect(approve).toBeDisabled();
  await expect(deny).toBeDisabled();
});

test("requires an answer to continue past the follow-up questions", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const question = "Which instrument does the band need?";

  const goal = await goalFixture({
    details: {
      answered: ["purpose", "level"],
      followUps: [{ answer: null, question }],
      level: "none",
      purpose: "deep",
    },
    planRevealedAt: null,
    userId: noProgressUser.id,
  });

  await page.goto(`/start/${goal.id}`);

  const answer = page.getByRole("textbox", { name: question });
  const next = page.getByRole("button", { exact: true, name: "Continue" });

  await expectHydrated(answer);
  await expect(next).toBeDisabled();
  await expect(page.getByRole("button", { exact: true, name: "Skip" })).toBeEnabled();

  await answer.fill("Piano");
  await expect(next).toBeEnabled();
  await answer.fill(" ");
  await expect(next).toBeDisabled();
});

test("keeps the German goal box the same height when typing starts on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 360 });
  await page.goto("/de/start");

  const box = page.locator('[data-slot="goal-field"]');
  const goal = box.getByRole("textbox");
  await expectHydrated(goal);
  await expect(goal).toBeEmpty();
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const emptyHeight = await box.evaluate((element) => element.getBoundingClientRect().height);

  await goal.pressSequentially("A");

  await expect(goal).toHaveValue("A");

  await expect
    .poll(() => box.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(emptyHeight);
});

function edges(element: Element) {
  const box = element.getBoundingClientRect();
  return { end: box.right, middle: (box.left + box.right) / 2, width: box.width };
}

test("centers a setup screen's column between the corners its bars hold on a computer", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/start");

  const actions = page.locator('[data-slot="bottom-bar-actions"]');
  const send = actions.getByRole("button", { name: "Build my plan" });
  await expectHydrated(send);

  const column = await page.locator('[data-slot="onboarding-column"]').evaluate(edges);
  const row = await actions.evaluate(edges);
  const action = await send.evaluate(edges);

  expect(column.width).toBeLessThan(row.width);
  expect(column.middle).toBeCloseTo(row.middle, 0);
  expect(action.end).toBeCloseTo(row.end, 0);

  // A room only a little wider than the column: it fills the room instead of stopping just short.
  await page.setViewportSize({ height: 900, width: 1280 });

  await expect
    .poll(async () => {
      const [narrowColumn, narrowRow] = await Promise.all([
        page.locator('[data-slot="onboarding-column"]').evaluate(edges),
        actions.evaluate(edges),
      ]);

      return Math.round(narrowRow.width - narrowColumn.width);
    })
    .toBe(0);
});

test("names the goal example the same way on the home and onboarding pages", async ({ page }) => {
  const goal = page.locator('[data-slot="goal-field"]').first().getByRole("textbox");

  await page.goto("/de");
  await expect(goal).toHaveAccessibleDescription(/^Zum Beispiel: /u);

  await page.goto("/de/start");
  await expect(goal).toHaveAccessibleDescription(/^Zum Beispiel: /u);
});

async function expectGoalRequired(page: Page) {
  const field = page.getByRole("textbox", { name: "I want to" }).first();
  const send = page.getByRole("button", { exact: true, name: "Build my plan" }).first();

  await expectHydrated(field);
  await expect(send).toBeDisabled();
  await field.fill("Learn algebra");
  await expect(send).toBeEnabled();
  await field.fill(" ");
  await expect(send).toBeDisabled();
}

test("requires a goal before building a plan on the landing page", async ({ page }) => {
  await page.goto("/");
  await expectGoalRequired(page);
});

test("requires a goal before building a plan in setup", async ({ page }) => {
  await page.goto("/start");
  await expectGoalRequired(page);
});

test("requires a selected subject to continue and lets beginners skip", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const citation = { passage: "Algebra and Geometry", sourceId: "notice" };

  const exam = await examBlueprintFixture({
    structure: {
      formats: [{ citation, description: "Five options", kind: "multipleChoice", options: 5 }],
      mock: null,
      rules: [],
      subjects: ["Algebra", "Geometry"].map((name) => ({
        citation,
        name,
        questions: 10,
        topics: [name],
        weight: null,
      })),
    },
  });

  const goal = await goalFixture({
    details: { answered: ["purpose", "target", "targetDate"] },
    examBlueprintId: exam.id,
    kind: "exam",
    planRevealedAt: null,
    userId: noProgressUser.id,
  });

  await page.goto(`/start/${goal.id}`);

  const subjects = page.getByRole("group", { name: "Subjects you know well" });
  const algebra = subjects.getByRole("checkbox", { name: "Algebra" });
  const next = page.getByRole("button", { exact: true, name: "Continue" });
  await expect(next).toBeDisabled();
  await expect(page.getByRole("button", { exact: true, name: "Skip" })).toBeEnabled();

  await algebra.click();
  await expect(next).toBeEnabled();
  await algebra.click();
  await expect(next).toBeDisabled();
});
