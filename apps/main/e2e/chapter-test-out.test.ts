import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { readOptions } from "./exam-fixtures";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { type Mode, asPersona } from "./learn-personas";
import { openAs } from "./study-day";

/**
 * Passing a chapter's test-out: Ana answers every question right, the chapter's lessons she still
 * had to take come off her plan, and the plan says so with an undo that puts them back.
 */

/** The right option of the bank question the test-out shows, found by its text. */
async function findRightOption(question: string): Promise<string> {
  const item = await prisma.item.findFirstOrThrow({
    where: { content: { equals: question, path: ["question"] } },
  });

  return readOptions(item.content).find((option) => option.isCorrect)?.text ?? "";
}

async function answerEveryQuestionRight(page: Page) {
  const progress = page.getByRole("progressbar", { name: /^Question 1 of \d+$/u });
  const label = await progress.getAttribute("aria-label");
  const total = Number(label?.match(/of (?<total>\d+)/u)?.groups?.total);

  for (const number of Array.from({ length: total }, (_, index) => index + 1)) {
    // oxlint-disable-next-line no-await-in-loop -- A test-out is answered one question at a time.
    await expect(
      page.getByRole("progressbar", { name: `Question ${number} of ${total}` }),
    ).toBeVisible();

    // oxlint-disable-next-line no-await-in-loop -- Each answer depends on the question shown.
    const question = (await page.getByRole("heading", { level: 2 }).textContent()) ?? "";

    // oxlint-disable-next-line no-await-in-loop -- Each answer depends on the question shown.
    await page.getByRole("button", { exact: true, name: await findRightOption(question) }).click();

    // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
    await page.getByRole("button", { name: number === total ? "Finish" : "Next" }).click();
  }
}

function countTestedOut(goalId: string) {
  return prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } });
}

test.describe("Passing a chapter test-out", () => {
  test("takes the chapter's lessons off the plan, with an undo", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const before = await countTestedOut(user.goalId);

      await page.goto("/plan");
      await page.getByRole("link", { name: "Test out of Porcentagem" }).click();
      await expect(page.getByText("Test out: Porcentagem")).toBeVisible();

      await answerEveryQuestionRight(page);

      await expect(page.getByRole("heading", { name: "You already know this" })).toBeVisible();

      await expect(
        page.getByText(
          /^\d+ lessons? (?:is|are) off your plan\. You can undo it from the plan\.$/u,
        ),
      ).toBeVisible();

      await expect.poll(() => countTestedOut(user.goalId)).toBeGreaterThan(before);

      await page.getByRole("link", { name: "Back to the plan" }).click();

      const change = page
        .getByRole("listitem")
        .filter({ hasText: /^You tested out of \d+ lessons?, so it.s off your plan\./u });

      await change.getByRole("button", { name: "Undo" }).click();
      await expect(change.getByText("Undone")).toBeVisible();

      await expect.poll(() => countTestedOut(user.goalId)).toBe(before);
    });
  });
});

const SKILLS = 3;
const GENERATIONS_URL = "**/v1/goals/*/chapters/*/test-out/generations";

/** A learner whose plan's first chapter has three skills and no question for any of them yet. */
async function createChapterWithoutQuestions(mode: Mode) {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);

  const [goal, chapter, skills] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Ratios ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Rates and ratios ${suffix}` }),
    Promise.all(
      Array.from({ length: SKILLS }, (_, index) =>
        skillFixture({ name: `Ratio skill ${index + 1} ${suffix}` }),
      ),
    ),
  ]);

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  await Promise.all(
    skills.map((skill, position) =>
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position, skillId: skill.id }),
    ),
  );

  /** The run's questions land in the shared bank, one per skill. */
  const writeQuestions = () =>
    Promise.all(
      skills.map((skill, index) =>
        itemFixture({
          content: choiceItemContent(`Ratio question ${index + 1} ${suffix}?`),
          skillId: skill.id,
        }),
      ),
    );

  return { chapter, user, writeQuestions };
}

test.describe("A chapter test-out without questions yet", () => {
  test("writes them when asked, follows the run and opens the test on its own", async ({
    browser,
  }) => {
    const { chapter, user, writeQuestions } = await createChapterWithoutQuestions("fun");
    const runId = `e2e-test-out-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [];

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });
    await page.goto(`/plan/test-out/${chapter.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: `Test out: ${chapter.title}` }),
    ).toBeVisible();

    await expect(page.getByText(/This chapter has no questions yet/u)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the plan" })).toBeVisible();

    events.push({ entityId: chapter.id, status: "started", step: "writeTestOutQuestions" });
    await page.getByRole("button", { name: "Get my questions ready" }).click();

    await expect(page.getByRole("progressbar", { name: "Writing your questions" })).toBeVisible();

    await writeQuestions();
    events.push({ entityId: chapter.id, status: "completed", step: "testOutQuestionsReady" });

    // No refresh: the test opens once its questions exist.
    await expect(page.getByRole("progressbar", { name: `Question 1 of ${SKILLS}` })).toBeVisible();

    await page.context().close();
  });

  test("says when writing them couldn't start, and a tap asks again", async ({ browser }) => {
    const { chapter, user, writeQuestions } = await createChapterWithoutQuestions("focus");
    const page = await openAs(browser, user);
    let reachable = false;

    await page.route(GENERATIONS_URL, (route) =>
      reachable
        ? route.fulfill({ json: { generationId: null, status: "ready" }, status: 200 })
        : route.fulfill({ json: { error: { code: "INTERNAL_ERROR" } }, status: 500 }),
    );

    await page.goto(`/plan/test-out/${chapter.id}`);
    await page.getByRole("button", { name: "Get my questions ready" }).click();

    const failed = page.getByRole("alert").filter({ hasText: "This didn't start" });
    await expect(failed).toBeVisible();

    // Written meanwhile (another tab asked): asking again finds them and opens the test.
    await writeQuestions();
    reachable = true;
    await failed.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("progressbar", { name: `Question 1 of ${SKILLS}` })).toBeVisible();

    await page.context().close();
  });

  test("says why when today's help is used up, and the way back stays", async ({ browser }) => {
    const { chapter, user } = await createChapterWithoutQuestions("focus");
    const page = await openAs(browser, user);

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { error: { code: "USAGE_LIMIT_REACHED", details: {} } }, status: 402 }),
    );

    await page.goto(`/plan/test-out/${chapter.id}`);
    await page.getByRole("button", { name: "Get my questions ready" }).click();

    await expect(
      page.getByText(
        "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();

    await page.getByRole("link", { name: "Back to the plan" }).click();
    await expect(page).toHaveURL(/\/plan$/u);
    await page.context().close();
  });
});
