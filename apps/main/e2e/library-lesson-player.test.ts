import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { createGoalLearner } from "./checkpoint-fixtures";
import { type Page, expect, test } from "./fixtures";

/**
 * Plays a Library lesson through the app: every teaching screen (the hook's guess, an explanation,
 * a worked example, a check, a typed and a spoken answer, the summary) for a signed-in learner,
 * checked by the server, to the completion; a plan lesson played from its chapter counting for the
 * plan and closing to the chapter; and a signed-in learner kept when the session check fails. What
 * single screens show, and where a lesson resumes, is the player's to test (`packages/player`).
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

async function readExplanation(page: Page) {
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
  await primary(page, /^Next/u).click();
}

async function followWorkedExample(page: Page) {
  await expect(page.getByText("Reading the cloud")).toBeVisible();
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
  const cantTalk = page.getByRole("button", { name: "I can't talk now" });

  if (await cantTalk.isVisible()) {
    await cantTalk.click();
  }

  await page.getByRole("textbox", { name: "Say it out loud" }).fill("The electron is a cloud");
  await primary(page, /^Check/u).click();
  await expectVerdict(page, "Correct!");
  await primary(page, /^Continue/u).click();
}

/**
 * Two playable lessons of a chapter, each one an item of the learner's plan for a later day, so
 * neither is in a session.
 */
async function createChapterLearner(browser: Browser) {
  const { goal, user } = await createGoalLearner();

  const [chapter, skill, first, second] = await Promise.all([
    libraryChapterFixture({ title: "Inside the atom" }),
    skillFixture({ name: "Atoms" }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
    playableLessonFixture({ lesson: { title: "Why the electron doesn't fall" }, steps: ["check"] }),
  ]);

  const nextWeek = new Date(Date.now() + 7 * MS_PER_DAY);
  const lessons = [first.lesson, second.lesson];

  const [
    {
      items: [firstItem],
    },
  ] = await Promise.all([
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson) => ({
        chapterId: chapter.id,
        lessonId: lesson.id,
        scheduledFor: nextWeek,
        skillId: skill.id,
      })),
    }),
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
    ]),
  ]);

  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  // These two lessons are already written. Their click asks the separate API for readiness;
  // without its narrow external mock the lane's API sink correctly refuses the request.
  await Promise.all(
    [first, second].map(({ lesson }) =>
      page.route(`**/v1/library/lessons/${lesson.id}/generations`, (route) =>
        route.fulfill({
          body: JSON.stringify({ status: "ready" }),
          contentType: "application/json",
        }),
      ),
    ),
  );

  return {
    chapterId: chapter.id,
    context,
    first: first.lesson,
    firstItemId: firstItem?.id ?? "",
    page,
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
    await readExplanation(page);
    await followWorkedExample(page);
    await answerCheckWithKeys(page);
    await answerTyped(page);
    await answerSpokenByTyping(page);

    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await primary(page, /^Continue/u).click();

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    await expect
      .poll(() =>
        prisma.learningEvent.findFirst({
          select: { correctAnswers: true },
          where: { endedAt: { not: null }, userId: noProgressUser.id },
        }),
      )
      .toStrictEqual({ correctAnswers: 3 });
  });

  test("a plan lesson played from its chapter, outside any session, counts for the plan and closes to the chapter", async ({
    browser,
  }) => {
    const { chapterId, context, first, firstItemId, page } = await createChapterLearner(browser);

    try {
      await page.goto(`/content/chapters/${chapterId}`);
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("0 of 2", { exact: true })).toBeVisible();
      await lessons.getByRole("link", { name: /^Up next 1\. An almost empty atom/u }).click();

      await expect(page).toHaveURL(new RegExp(`/learn/${first.id}$`, "u"));
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

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

      await page.getByRole("link", { name: "Back to chapter" }).click();
      await expect(page).toHaveURL(new RegExp(`/content/chapters/${chapterId}$`, "u"));
      await expect(lessons.getByText("1 of 2", { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("keeps a signed-in learner when the session check fails, and opens the lesson on a retry", async ({
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "check"] });

    const sessionCookie = async () => {
      const cookies = await page.context().cookies();
      return cookies.find((cookie) => cookie.name.includes("session_token"))?.value;
    };

    const signedIn = await sessionCookie();
    expect(signedIn).toBeTruthy();
    const guestSignIns: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/sign-in/anonymous")) {
        guestSignIns.push(request.url());
      }
    });

    // A rate limit (or a network error) on the check says nothing about the session: never a guest.
    await page.route("**/api/auth/get-session**", (route) =>
      route.fulfill({ body: "{}", contentType: "application/json", status: 429 }),
    );

    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByRole("heading", { name: "We couldn't open this lesson" })).toBeVisible();
    expect(guestSignIns).toStrictEqual([]);

    await page.unroute("**/api/auth/get-session**");
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    expect(guestSignIns).toStrictEqual([]);
    await expect.poll(sessionCookie).toBe(signedIn);
  });
});
