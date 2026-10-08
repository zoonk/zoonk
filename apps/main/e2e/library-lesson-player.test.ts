import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { createGoalLearner } from "./checkpoint-fixtures";
import { type Page, expect, test } from "./fixtures";

/**
 * Plays a Library lesson through the app: every teaching screen (the hook's guess, an explanation,
 * a worked example, a check, a typed and a spoken answer, the summary) for a signed-in learner,
 * checked by the server, to the completion; coming back to a lesson where the learner left off;
 * a plan lesson played from its chapter counting for the plan, closing to the chapter and going on
 * to its next lesson; and the short break the page asks for when lessons are read too fast. What
 * single screens show is the player's to test (`packages/player`).
 */

const RIGHT_TYPED = "It shows where the electron is likely to be";

function primary(page: Page, label: RegExp) {
  return page.getByRole("button", { name: label });
}

async function expectVerdict(page: Page, verdict: string) {
  await expect(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

async function answerHook(page: Page) {
  await expect(page.getByText("Guess first")).toBeVisible();
  await page.getByRole("radio", { name: "No" }).click();
  await primary(page, /^See the answer/u).click();
  await expectVerdict(page, "Good guess!");
  await primary(page, /^Continue/u).click();
}

/** The tutor opens over the screen and Escape closes only the tutor, never the lesson. */
async function openAndCloseTutor(page: Page, { expectText }: { expectText: string }) {
  await page.getByRole("button", { name: "Ask Buddy" }).click();
  const tutor = page.getByRole("dialog", { name: "Buddy" });
  await expect(tutor.getByText(expectText)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tutor).toBeHidden();
}

async function readExplanationWithHelp(page: Page) {
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

  await openAndCloseTutor(page, { expectText: "Ask about this screen" });
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

  // Made with AI, said once in the screen's menu; Escape closes the menu, not the lesson.
  await page.getByRole("button", { name: "Screen options" }).click();
  await expect(page.getByText("Made with AI. It may contain mistakes.")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Report a problem" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Made with AI. It may contain mistakes.")).toBeHidden();
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

  await primary(page, /^Next/u).click();
}

async function followWorkedExample(page: Page) {
  await expect(page.getByText("Reading the cloud")).toBeVisible();
  await expect(page.getByText("The darkest part sits just around the nucleus.")).toBeHidden();

  await primary(page, /^Show the next step/u).click();
  await expect(page.getByText("The darkest part sits just around the nucleus.")).toBeVisible();
  await primary(page, /^Show the next step/u).click();

  await expect(
    page.getByText("Most likely just around the nucleus, where the cloud is densest."),
  ).toBeVisible();

  await page.keyboard.press("Enter");
}

async function answerCheckWithKeys(page: Page) {
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
  await page.keyboard.press("2");

  await expect(
    page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
  ).toBeChecked();

  await page.keyboard.press("Enter");
  await expectVerdict(page, "Correct!");
  await page.keyboard.press("Enter");
}

async function answerTyped(page: Page) {
  await page
    .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
    .fill(RIGHT_TYPED);

  await primary(page, /^Check/u).click();
  await expectVerdict(page, "Correct!");
  await primary(page, /^Continue/u).click();
}

async function answerSpokenByTyping(page: Page) {
  await expect(page.getByText("The electron is a cloud")).toBeVisible();
  const typeInstead = page.getByRole("button", { name: "Type it instead" });

  if (await typeInstead.isVisible()) {
    await typeInstead.click();
  }

  await page.getByRole("textbox", { name: "Say it out loud" }).fill("The electron is a cloud");
  await primary(page, /^Check/u).click();
  await expectVerdict(page, "Correct!");

  // Hyperdrive: the check, the written and the spoken answer, right in a row.
  await expect(page.getByText("3 right in a row")).toBeVisible();
  await primary(page, /^Continue/u).click();
}

/**
 * Two playable lessons of a chapter, each one an item of the learner's plan for a later day, so
 * neither is in a session.
 */
async function createChapterLearner(browser: Browser) {
  const { goal, user } = await createGoalLearner();

  const [plan, chapter, first, second] = await Promise.all([
    planFixture({ goalId: goal.id }),
    libraryChapterFixture({ title: "Inside the atom" }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
    playableLessonFixture({ lesson: { title: "Why the electron doesn't fall" }, steps: ["check"] }),
  ]);

  const nextWeek = new Date(Date.now() + 7 * MS_PER_DAY);

  const [firstItem] = await Promise.all([
    planItemFixture({
      chapterId: chapter.id,
      lessonId: first.lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: nextWeek,
    }),
    planItemFixture({
      chapterId: chapter.id,
      lessonId: second.lesson.id,
      planId: plan.id,
      position: 1,
      scheduledFor: nextWeek,
    }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: first.lesson.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: second.lesson.id, position: 1 }),
    ...[first, second].map(({ lesson }) =>
      prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
    ),
  ]);

  const context = await browser.newContext({ storageState: user.storageState });

  return {
    chapterId: chapter.id,
    context,
    first: first.lesson,
    firstItemId: firstItem.id,
    page: await context.newPage(),
    second: second.lesson,
  };
}

test.describe("Library lesson player", () => {
  test("plays every teaching screen and finishes the lesson", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture();

    await page.goto(`/learn/${lesson.id}`);

    await answerHook(page);
    await readExplanationWithHelp(page);
    await followWorkedExample(page);
    await answerCheckWithKeys(page);
    await answerTyped(page);
    await answerSpokenByTyping(page);

    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await primary(page, /^Continue/u).click();

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    // Brain Power v2: 2, 4 and 6 for three right answers in a row, and 10 for finishing.
    const facts = page.locator('[data-slot="lesson-completion"]').getByRole("listitem");
    await expect(facts.filter({ hasText: "3 of 3 right" })).toBeVisible();
    await expect(facts.filter({ hasText: "+22 Brain Power" })).toBeVisible();

    // A lesson outside the learner's plan goes back to Today.
    await expect(page.getByRole("link", { name: /^Continue/u })).toHaveAttribute(
      "href",
      /\/today$/u,
    );

    await expect
      .poll(() =>
        prisma.learningEvent.findFirst({
          select: { correctAnswers: true },
          where: { endedAt: { not: null }, userId: noProgressUser.id },
        }),
      )
      .toStrictEqual({ correctAnswers: 3 });
  });

  test("comes back where the learner left off after a reload, and finishes", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({
      steps: [
        "explanation",
        "check",
        {
          content: { ...playableStepContent.explanation, title: "Denser means more likely" },
          kind: "explanation",
        },
        "check",
      ],
    });

    await page.goto(`/learn/${lesson.id}`);
    await primary(page, /^Next/u).click();
    await answerCheckWithKeys(page);
    await expect(page.getByText("Denser means more likely")).toBeVisible();

    // The answer reached the server, which is what the lesson comes back from.
    await expect.poll(() => prisma.attempt.count({ where: { userId: noProgressUser.id } })).toBe(1);

    await page.reload();

    await expect(page.getByText("Denser means more likely")).toBeVisible();
    await expect(page.getByText("A cloud, not a little ball")).toBeHidden();

    await primary(page, /^Next/u).click();
    await answerCheckWithKeys(page);

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    await expect(page.getByText(/^2 of 2 right/u)).toBeVisible();
  });

  test("comes back days later where the learner left off, in a new run, and finishes", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({
      steps: [
        "explanation",
        "check",
        {
          content: { ...playableStepContent.explanation, title: "Denser means more likely" },
          kind: "explanation",
        },
        "check",
      ],
    });

    await page.goto(`/learn/${lesson.id}`);
    await primary(page, /^Next/u).click();
    await answerCheckWithKeys(page);
    await expect(page.getByText("Denser means more likely")).toBeVisible();
    await expect.poll(() => prisma.attempt.count({ where: { userId: noProgressUser.id } })).toBe(1);

    // The learner left two days ago: long past the half hour a run stays open.
    const twoDaysAgo = new Date(Date.now() - 2 * MS_PER_DAY);

    await Promise.all([
      prisma.learningEvent.updateMany({
        data: { startedAt: twoDaysAgo },
        where: { userId: noProgressUser.id },
      }),
      prisma.attempt.updateMany({
        data: { answeredAt: new Date(twoDaysAgo.getTime() + 60_000) },
        where: { userId: noProgressUser.id },
      }),
    ]);

    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByText("Denser means more likely")).toBeVisible();
    await expect(page.getByText("A cloud, not a little ball")).toBeHidden();

    await primary(page, /^Next/u).click();
    await answerCheckWithKeys(page);

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    await expect(page.getByText(/^2 of 2 right/u)).toBeVisible();

    const runs = await prisma.learningEvent.findMany({
      orderBy: { startedAt: "asc" },
      select: { correctAnswers: true, endedAt: true },
      where: { userId: noProgressUser.id },
    });

    // The sitting two days ago stays open; today's run finished the lesson with both answers.
    expect(runs).toMatchObject([
      { endedAt: null },
      { correctAnswers: 2, endedAt: expect.any(Date) },
    ]);
  });

  test("a plan lesson played from its chapter, outside any session, counts for the plan, closes to the chapter and goes on to the next lesson", async ({
    browser,
  }) => {
    const { chapterId, context, first, firstItemId, page, second } =
      await createChapterLearner(browser);

    try {
      await page.goto(`/content/chapters/${chapterId}`);
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("0 of 2", { exact: true })).toBeVisible();
      await lessons.getByRole("link", { name: /^Up next 1\. An almost empty atom/u }).click();

      await expect(page).toHaveURL(new RegExp(`/learn/${first.id}$`, "u"));
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      await expect(page.getByRole("link", { name: "Close lesson" })).toHaveAttribute(
        "href",
        new RegExp(`/content/chapters/${chapterId}$`, "u"),
      );

      await primary(page, /^Continue/u).click();
      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      // Finishing a plan lesson anywhere checks it off the plan, a week before its day.
      await expect
        .poll(async () =>
          prisma.planItem.findUniqueOrThrow({
            select: { status: true },
            where: { id: firstItemId },
          }),
        )
        .toStrictEqual({ status: "done" });

      await expect(page.getByRole("link", { name: /^Next lesson/u })).toHaveAttribute(
        "href",
        new RegExp(`/learn/${second.id}$`, "u"),
      );

      await page.getByRole("link", { name: "Back to chapter" }).click();
      await expect(page).toHaveURL(new RegExp(`/content/chapters/${chapterId}$`, "u"));
      await expect(lessons.getByText("1 of 2", { exact: true })).toBeVisible();

      await expect(
        lessons.getByRole("link", { name: /^Done 1\. An almost empty atom/u }),
      ).toBeVisible();

      await lessons
        .getByRole("link", { name: /^Up next 2\. Why the electron doesn't fall/u })
        .click();

      await expect(page).toHaveURL(new RegExp(`/learn/${second.id}$`, "u"));
      await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("asks for a short break when lessons are read too fast, then opens the lesson", async ({
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "check"] });

    // E2E servers stand in for the Vercel Firewall: this header answers as the rule's limit would.
    await page.setExtraHTTPHeaders({ "x-e2e-rate-limited": "lesson-steps" });
    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByRole("heading", { name: "Take a short break" })).toBeVisible();
    await expect(page.getByText(/This one opens in \d+ seconds\./u)).toBeVisible();
    await expect(page.getByText("A cloud, not a little ball")).toBeHidden();

    await page.setExtraHTTPHeaders({});
    await page.reload();
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
  });
});
