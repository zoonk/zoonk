import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { openAs } from "./study-day";

/**
 * When the learner's time doesn't cover everything in depth, the focus test lets their answers
 * choose where the depth goes: a few questions on each subject, then what each subject showed and
 * the focus it set, with an undo.
 */

const GENERATIONS_URL = "**/v1/goals/*/plan/focus-test/generations";
const AREAS = ["Algebra", "Geometry"] as const;
const SKILLS_PER_AREA = 4;
const DAYS_TO_DATE = 60;
const DAILY_MINUTES = 10;

/**
 * A learner ten minutes a day, two months from their date, with a plan of two subjects far bigger
 * than that: their time doesn't cover everything in depth. Only algebra has its questions yet
 * (none without `withAlgebra`); `writeQuestions` adds the others, as the API's run would.
 */
async function createShortOnTimeLearner({ withAlgebra = true } = {}) {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const today = toUTCMidnight(new Date());

  const [goal, skills] = await Promise.all([
    goalFixture({
      dailyMinutes: DAILY_MINUTES,
      targetDate: new Date(today.getTime() + DAYS_TO_DATE * MS_PER_DAY),
      timezone: "UTC",
      title: `Pass the math test ${suffix}`,
      userId: user.id,
    }),
    Promise.all(
      AREAS.flatMap((area) =>
        Array.from({ length: SKILLS_PER_AREA }, async (_, index) => ({
          area,
          skill: await skillFixture({ name: `${area} skill ${index + 1} ${suffix}` }),
        })),
      ),
    ),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Foundations" }],
      skills: skills.map(({ area, skill }) => ({
        area,
        lessons: 30,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    phases: [{ name: "Foundations" }],
    settings: { startDate: today.toISOString().slice(0, "YYYY-MM-DD".length) },
  });

  const writeItems = (area: (typeof AREAS)[number]) =>
    Promise.all(
      skills
        .filter((entry) => entry.area === area)
        .map(({ skill }) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    );

  await Promise.all([
    ...skills.map(({ skill }, position) =>
      planItemFixture({ planId: plan.id, position, scheduledFor: today, skillId: skill.id }),
    ),
    withAlgebra ? writeItems("Algebra") : null,
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const writeQuestions = () =>
    withAlgebra
      ? writeItems("Geometry")
      : Promise.all([writeItems("Algebra"), writeItems("Geometry")]);

  return { goal, user, writeQuestions };
}

async function loadFocusAreas(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return isJsonObject(plan.settings) ? plan.settings.focusAreas : null;
}

test.describe("The focus test", () => {
  test("from where to focus, a short test chooses the subjects the answers show need depth", async ({
    browser,
  }) => {
    const { goal, user, writeQuestions } = await createShortOnTimeLearner();
    const runId = `e2e-focus-test-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [];

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });

    // Where to focus offers the test first, then choosing by hand.
    await page.goto("/journey");
    await page.getByRole("button", { name: "Choose where to focus" }).click();

    await page
      .getByRole("dialog", { name: "Where to focus" })
      .getByRole("link", { name: /^Take a short test/u })
      .click();

    // Opening the test writes nothing: it says what it is, and the learner's tap starts it.
    await expect(page).toHaveURL(/\/focus-test$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: "Where should you focus?" }),
    ).toBeVisible();

    await expect(page.getByText("2 subjects", { exact: true })).toBeVisible();
    await expect(page.getByText("8 questions", { exact: true })).toBeVisible();
    await expectAccessibleScreen(page, "the focus test's opening");

    // Geometry has no questions yet: Start writes them while algebra's, which exist, are asked.
    events.push({ status: "started", step: "writeFocusTestQuestions" });
    await page.getByRole("button", { name: "Start the test" }).click();
    await expect(page).toHaveURL(new RegExp(`/focus-test\\?run=${runId}$`, "u"));

    // Subject by subject: algebra known, geometry not yet.

    for (const number of [1, 2, 3, 4]) {
      // oxlint-disable-next-line no-await-in-loop -- The test is answered one question at a time.
      await expect(
        page.getByRole("progressbar", { name: `Question ${number} of 8` }),
      ).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await expect(page.getByRole("main").getByText("Algebra", { exact: true })).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { exact: true, name: "Right answer" }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { name: "Next" }).click();
    }

    // Algebra's answered before geometry's are written: the test waits for them, then goes on.
    await expect(
      page.getByRole("heading", { level: 2, name: "Your next questions are on the way" }),
    ).toBeVisible();

    await expect(page.getByRole("progressbar", { name: "Question 5 of 8" })).toBeVisible();
    await expectAccessibleScreen(page, "the focus test waiting for its next questions");

    await writeQuestions();
    events.push({ status: "completed", step: "focusTestQuestionsReady" });

    for (const number of [5, 6, 7, 8]) {
      // oxlint-disable-next-line no-await-in-loop -- The test is answered one question at a time.
      await expect(
        page.getByRole("progressbar", { name: `Question ${number} of 8` }),
      ).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await expect(page.getByRole("main").getByText("Geometry", { exact: true })).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { name: "I don't know yet" }).click();
    }

    // First how each subject went, then the focus it set and why.
    await expect(page.getByRole("heading", { level: 1, name: "How you did" })).toBeVisible();
    await expect(page.getByText("4 of 4 right")).toBeVisible();
    await expect(page.getByText("0 of 4 right")).toBeVisible();
    await expect.poll(() => loadFocusAreas(goal.id)).toStrictEqual(["Geometry"]);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Geometry" })).toBeVisible();
    await expect(page.getByText(/where you missed most/u)).toBeVisible();

    // Changed their mind: the focus goes back to how it was, right here.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("heading", { name: "Your plan is back as it was" })).toBeVisible();
    await expect.poll(() => loadFocusAreas(goal.id)).toStrictEqual([]);

    await page.getByRole("link", { name: "See your plan" }).click();
    await expect(page).toHaveURL(/\/journey$/u);
    await page.context().close();
  });

  test("a test without any question yet opens once they're written", async ({ browser }) => {
    const { user, writeQuestions } = await createShortOnTimeLearner({ withAlgebra: false });
    const runId = `e2e-focus-test-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [{ status: "started", step: "writeFocusTestQuestions" }];

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });
    await page.goto("/focus-test");
    await page.getByRole("button", { name: "Start the test" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Getting your test ready" }),
    ).toBeVisible();

    await writeQuestions();
    events.push({ status: "completed", step: "focusTestQuestionsReady" });

    await expect(page.getByRole("progressbar", { name: "Question 1 of 8" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Algebra", { exact: true })).toBeVisible();
    await page.context().close();
  });

  test("a subject the plan has one area of isn't a choice: the test sends back to the Journey", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    const skill = await skillFixture({ name: `Only skill ${randomUUID().slice(0, 6)}` });

    await Promise.all([
      planFixture({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Basics" }],
          skills: [
            {
              area: "Algebra",
              lessons: 2,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            },
          ],
        },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/focus-test");
    await expect(page).toHaveURL(/\/journey$/u);
    await page.context().close();
  });
});
