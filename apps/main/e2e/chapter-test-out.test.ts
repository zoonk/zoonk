import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { openAs } from "./study-day";

const GENERATIONS_URL = "**/v1/goals/*/chapters/*/test-out/generations";
const RIGHT = "Right answer";
const SUMMARY_LESSON = "Ratios in one picture";

/** A finished lesson's summary idea, with math the chapter page draws as lessons do. */
const SUMMARY_IDEA = String.raw`A ratio of 3 to 4 is the fraction $\frac{3}{4}$ of the whole.`;

const DAYS_PER_WEEK = 7;
const STUDY_MINUTES = 30;

/**
 * The plan's skill graph and settings, so the planner owns the plan: a test-out's skip then
 * re-plans around it.
 */
function plannerOwned(skills: readonly { id: string; name: string }[]) {
  return {
    graph: {
      phases: [{ milestone: null, name: "Ratios" }],
      skills: skills.map((skill) => ({
        area: null,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    settings: {
      startDate: toUTCMidnight(new Date()).toISOString().slice(0, "YYYY-MM-DD".length),
      weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => STUDY_MINUTES),
    },
  };
}

/**
 * A learner whose plan's one chapter has a lesson for each of a few skills, after a finished lesson
 * that left its summary. The test-out asks at least four questions spread over the skills (one
 * each from four skills on, two each below), so `writeQuestions` adds two per skill to the bank
 * the way the API's run would.
 */
async function createTestOutChapter({
  planned = false,
  skills: skillCount,
}: {
  /** The planner owns the plan, so the skip shows on it. */
  planned?: boolean;
  skills: number;
}) {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const indexes = Array.from({ length: skillCount }, (_, index) => index);

  const [goal, chapter, summaryLesson, skills, lessons] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Ratios ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Rates and ratios ${suffix}` }),
    libraryLessonFixture({
      summary: { ideas: [{ text: SUMMARY_IDEA }] },
      title: `${SUMMARY_LESSON} ${suffix}`,
    }),
    Promise.all(
      indexes.map((index) => skillFixture({ name: `Ratio skill ${index + 1} ${suffix}` })),
    ),
    Promise.all(
      indexes.map((index) =>
        libraryLessonFixture({ title: `Ratio lesson ${index + 1} ${suffix}` }),
      ),
    ),
  ]);

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id, ...(planned ? plannerOwned(skills) : {}) }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: summaryLesson.id, position: 0 }),
    Promise.all(
      lessons.map((lesson, index) =>
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: index + 1 }),
      ),
    ),
    prisma.lessonSkill.createMany({
      data: lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        skillId: skills[index]?.id ?? "",
      })),
    }),
  ]);

  await Promise.all(
    [summaryLesson, ...lessons].map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        status: lesson === summaryLesson ? "done" : "todo",
        titleSnapshot: lesson.title,
      }),
    ),
  );

  const writeQuestions = () =>
    Promise.all(
      skills.flatMap((skill, index) =>
        [1, 2].map((copy) =>
          itemFixture({
            content: choiceItemContent(`Ratio question ${index + 1}.${copy} ${suffix}?`),
            skillId: skill.id,
          }),
        ),
      ),
    );

  return { chapter, goal, user, writeQuestions };
}

/** The right option of the question shown, picked by its number key, then Enter moves on. */
async function answerRightByKeyboard(page: Page) {
  // Each option reads as its number key followed by its text.
  const options = await page.getByRole("main").getByRole("listitem").allTextContents();
  const key = options.findIndex((option, index) => option === `${index + 1}${RIGHT}`) + 1;

  await page.keyboard.press(String(key));

  await expect(page.getByRole("button", { exact: true, name: RIGHT })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(page.getByRole("button", { name: /^(?:Next|Finish)$/u })).toBeEnabled();
  await page.keyboard.press("Enter");
}

/** Waits for question `number` of `total` to show. */
async function expectQuestion(page: Page, number: number, total: number) {
  await expect(
    page.getByRole("progressbar", { name: `Question ${number} of ${total}` }),
  ).toBeVisible();
}

function countTestedOut(goalId: string) {
  return prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } });
}

/**
 * A chapter's test-out, full screen from the chapter's "Take the test": at least four questions
 * spread over its skills, and only the skills answered right count as known. When the questions still have to be written,
 * the tap starts that run and the test opens once it's done; a test opened any other way waits for
 * the learner's tap. Tests never reach a model: the API's writing run is stood in for.
 */
test.describe("Chapter test-out", () => {
  test("opens from the chapter and takes off only the skills answered right", async ({
    browser,
  }) => {
    const SKILLS = 5;

    const { chapter, goal, user, writeQuestions } = await createTestOutChapter({
      planned: true,
      skills: SKILLS,
    });

    const chapterUrl = new RegExp(`/content/chapters/${chapter.id}$`, "u");

    await writeQuestions();
    const page = await openAs(browser, user);

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: null, status: "ready" }, status: 200 }),
    );

    await page.goto(`/content/chapters/${chapter.id}`);

    // The finished lesson's summary, folded away, its math drawn as lessons draw it.
    await page.getByRole("button", { name: "Chapter summary" }).click();
    const summaries = page.getByRole("region", { name: "Summaries" });

    await expect(
      summaries.getByRole("heading", { name: new RegExp(SUMMARY_LESSON, "u") }),
    ).toBeVisible();

    await expect(summaries.getByRole("math")).toHaveCount(1);
    await expect(summaries).toContainText("A ratio of 3 to 4 is the fraction");
    await expect(summaries).not.toContainText("$");

    await page.getByRole("button", { name: "Take the test" }).click();

    await expect(page).toHaveURL(new RegExp(`/test-out/${chapter.id}$`, "u"));

    // Full screen like every task: close back to the chapter, how far in, a menu and one bar.
    await expect(
      page.getByRole("heading", { level: 1, name: `Test out: ${chapter.title}` }),
    ).toBeVisible();

    await expect(page.getByText(`1 of ${SKILLS}`, { exact: true })).toBeVisible();
    await expectQuestion(page, 1, SKILLS);
    await expect(page.getByRole("button", { name: "Question options" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Close" })).toHaveAttribute("href", chapterUrl);
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
    await expectAccessibleScreen(page, "a chapter test-out");

    // Four right (the first from the keyboard), and one not known yet: 80% passes.
    await answerRightByKeyboard(page);

    for (const number of [2, 3, 4]) {
      // oxlint-disable-next-line no-await-in-loop -- A test-out is answered one question at a time.
      await expectQuestion(page, number, SKILLS);
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { exact: true, name: RIGHT }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { name: "Next" }).click();
    }

    await expectQuestion(page, SKILLS, SKILLS);
    await page.getByRole("button", { name: "I don't know yet" }).click();

    const result = page.getByRole("status").filter({ hasText: "You already know this" });
    await expect(result.getByRole("heading", { name: "You already know this" })).toBeVisible();
    await expect(result.getByText(`4 of ${SKILLS} right`)).toBeVisible();

    // Only the four skills answered right come off the plan; the fifth stays.
    await expect(result.getByText("4 lessons are off your plan.")).toBeVisible();
    await expect.poll(() => countTestedOut(goal.id)).toBe(4);

    // Changed their mind: the lessons come back right here, and the undo goes away.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(result.getByText("The lessons are back in your plan.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
    await expect.poll(() => countTestedOut(goal.id)).toBe(0);

    // The task's one way on sits under the result.
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(chapterUrl);
    await page.context().close();
  });

  test("keeps each answer as it's given: a reload goes on from the next question", async ({
    browser,
  }) => {
    const SKILLS = 4;

    const { chapter, goal, user, writeQuestions } = await createTestOutChapter({
      planned: true,
      skills: SKILLS,
    });

    await writeQuestions();
    const page = await openAs(browser, user);
    await page.goto(`/test-out/${chapter.id}`);

    for (const number of [1, 2]) {
      // oxlint-disable-next-line no-await-in-loop -- A test-out is answered one question at a time.
      await expectQuestion(page, number, SKILLS);
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { exact: true, name: RIGHT }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { name: "Next" }).click();
    }

    await expectQuestion(page, 3, SKILLS);
    await page.reload();

    // The two answers given before the reload still count.
    await expectQuestion(page, 3, SKILLS);

    for (const number of [3, 4]) {
      // oxlint-disable-next-line no-await-in-loop -- A test-out is answered one question at a time.
      await expectQuestion(page, number, SKILLS);
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { exact: true, name: RIGHT }).click();
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { name: /^(?:Next|Finish)$/u }).click();
    }

    const result = page.getByRole("status").filter({ hasText: "You already know this" });
    await expect(result.getByText(`${SKILLS} of ${SKILLS} right`)).toBeVisible();
    await expect.poll(() => countTestedOut(goal.id)).toBe(SKILLS);
    await page.context().close();
  });

  test("written on the chapter's tap, it follows the run and opens the test on its own", async ({
    browser,
  }) => {
    // Three skills take four questions: never fewer, so a lucky answer never skips the chapter.
    const QUESTIONS = 4;
    const { chapter, user, writeQuestions } = await createTestOutChapter({ skills: 3 });
    const runId = `e2e-test-out-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [];

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });
    await page.goto(`/content/chapters/${chapter.id}`);

    events.push({ entityId: chapter.id, status: "started", step: "writeTestOutQuestions" });
    await page.getByRole("button", { name: "Take the test" }).click();

    await expect(page).toHaveURL(new RegExp(`/test-out/${chapter.id}\\?run=${runId}$`, "u"));
    await expect(page.getByText("Getting your test ready")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Writing your questions" })).toBeVisible();

    await writeQuestions();
    events.push({ entityId: chapter.id, status: "completed", step: "testOutQuestionsReady" });

    // No refresh: the test opens once its questions exist.
    await expectQuestion(page, 1, QUESTIONS);

    for (const number of [1, 2, 3, 4]) {
      // oxlint-disable-next-line no-await-in-loop -- A test-out is answered one question at a time.
      await expectQuestion(page, number, QUESTIONS);
      // oxlint-disable-next-line no-await-in-loop -- Each answer waits for the one before.
      await page.getByRole("button", { name: "I don't know yet" }).click();
    }

    const result = page.getByRole("status").filter({ hasText: "Not yet, and that's fine" });
    await expect(result.getByRole("heading", { name: "Not yet, and that's fine" })).toBeVisible();
    await expect(result.getByText(`0 of ${QUESTIONS} right`)).toBeVisible();

    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(new RegExp(`/content/chapters/${chapter.id}$`, "u"));
    await page.context().close();
  });

  test("opened without questions, a tap writes them, and says when that couldn't start", async ({
    browser,
  }) => {
    const { chapter, user, writeQuestions } = await createTestOutChapter({ skills: 3 });
    const page = await openAs(browser, user);
    let reachable = false;

    await page.route(GENERATIONS_URL, (route) =>
      reachable
        ? route.fulfill({ json: { generationId: null, status: "ready" }, status: 200 })
        : route.fulfill({ json: { error: { code: "INTERNAL_ERROR" } }, status: 500 }),
    );

    // Loading the page writes nothing: the learner's tap (or Enter) does.
    await page.goto(`/test-out/${chapter.id}`);
    await expect(page.getByRole("heading", { level: 2, name: "Already know this?" })).toBeVisible();
    await expect(page.getByText("Getting your test ready")).toBeHidden();
    await page.getByRole("button", { name: "Start the test" }).click();

    const failed = page.getByRole("alert").filter({ hasText: "This didn't start" });
    await expect(failed).toBeVisible();

    // Written meanwhile (another tab asked): asking again finds them and opens the test.
    await writeQuestions();
    reachable = true;
    await failed.getByRole("button", { name: "Try again" }).click();

    // Three skills take four questions: never fewer, so a lucky answer never skips the chapter.
    await expectQuestion(page, 1, 4);
    await page.context().close();
  });

  test("says why when today's help is used up, and closes back to the chapter", async ({
    browser,
  }) => {
    const { chapter, user } = await createTestOutChapter({ skills: 3 });
    const page = await openAs(browser, user);

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { error: { code: "USAGE_LIMIT_REACHED", details: {} } }, status: 402 }),
    );

    await page.goto(`/test-out/${chapter.id}`);
    await page.getByRole("button", { name: "Start the test" }).click();

    await expect(
      page.getByText(
        "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();

    await page.getByRole("link", { name: "Close" }).click();
    await expect(page).toHaveURL(new RegExp(`/content/chapters/${chapter.id}$`, "u"));
    await page.context().close();
  });
});
