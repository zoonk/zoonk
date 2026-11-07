import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { TEACHING_LESSON_STEPS } from "@zoonk/testing/fixtures/playable-step-contents";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";

const RIGHT_TYPED = "It shows where the electron is likely to be";

function primary(page: Page, label: RegExp) {
  return page.getByRole("button", { name: label });
}

async function expectVerdict(page: Page, verdict: string) {
  await expect(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

async function answerHook(page: Page) {
  await expect(page.getByText("Just a guess, it doesn't count")).toBeVisible();
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

async function createChapterGuest(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const userId = await ensureGuest(page);
  const goal = await goalFixture({ timezone: "UTC", title: "Understand atoms", userId });

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
    learningProfileFixture({ activeGoalId: goal.id, userId }),
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
    ]),
  ]);

  // The click asks the separate API for readiness, which isn't running here.
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
  test("plays every teaching screen, shows the lesson map and finishes the lesson", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({
      lesson: {
        summary: {
          ideas: [
            { label: "Organism", text: "An organism is one living thing." },
            { label: "Population", text: "A population is one species living in one place." },
          ],
          shape: "nested",
        },
      },
      steps: TEACHING_LESSON_STEPS.filter((kind) => kind !== "summary"),
    });

    await page.goto(`/learn/${lesson.id}`);

    await answerHook(page);
    await readExplanation(page);
    await followWorkedExample(page);
    await answerCheckWithKeys(page);
    await answerTyped(page);
    await answerSpokenByTyping(page);

    const map = page.getByRole("main").getByRole("heading", { name: "Lesson map" });
    await expect(map).toBeVisible();
    await expect(page.getByText("A population is one species living in one place.")).toBeVisible();
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

  test("a guest's plan lesson played from its chapter, outside any session, counts for the plan and closes to the chapter", async ({
    browser,
  }) => {
    const { chapterId, context, first, firstItemId, page } = await createChapterGuest(browser);

    try {
      await page.goto(`/content/chapters/${chapterId}`);
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("0 of 2", { exact: true })).toBeVisible();
      await lessons.getByRole("link", { name: /^Up next 1\. An almost empty atom/u }).click();

      await expect(page).toHaveURL(new RegExp(`/learn/${first.id}$`, "u"));
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      await primary(page, /^Continue/u).click();
      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

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

  test("keeps a miss whose save didn't get through across a reload and saves it to the notebook", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({
      steps: [
        "explanation",
        "check",
        {
          content: { text: "Denser means more likely.", title: "Reading it" },
          kind: "explanation",
        },
        "check",
      ],
    });

    const missed = steps[1]?.id ?? "";
    const notSaved = page.getByRole("button", { name: "Not saved yet" });

    await page.goto(`/learn/${lesson.id}`);
    await readExplanation(page);

    await page.route("**/api/steps/*/checks", (route) => route.abort("internetdisconnected"));
    await page.getByRole("radio", { name: "The electron's exact path" }).click();
    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Not quite");
    await expect(notSaved).toBeVisible();

    await page.unroute("**/api/steps/*/checks");
    await page.reload();

    await expect(page.getByText("Reading it")).toBeVisible();
    await expect(notSaved).toBeHidden();

    await expect
      .poll(() =>
        prisma.attempt.findMany({
          select: { isCorrect: true },
          where: { stepId: missed, userId: noProgressUser.id },
        }),
      )
      .toStrictEqual([{ isCorrect: false }]);

    await expect
      .poll(() => prisma.mistake.count({ where: { stepId: missed, userId: noProgressUser.id } }))
      .toBe(1);
  });

  test("shows a question answered before a reload as answered on the way back, and counts it once", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({
      steps: [
        "explanation",
        "check",
        {
          content: { text: "Denser means more likely.", title: "Reading it" },
          kind: "explanation",
        },
        "check",
      ],
    });

    const answered = steps[1]?.id ?? "";

    const attempts = () =>
      prisma.attempt.count({ where: { stepId: answered, userId: noProgressUser.id } });

    const rightOption = page.getByRole("radio", {
      name: "Where the electron is most likely to be found",
    });

    await page.goto(`/learn/${lesson.id}`);
    await readExplanation(page);
    await rightOption.click();
    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Correct!");
    await expect.poll(attempts).toBe(1);

    await page.reload();
    await expect(page.getByText("Reading it")).toBeVisible();

    await page.getByRole("button", { name: "Previous screen" }).click();
    await expect(rightOption).toBeChecked();
    await expectVerdict(page, "Correct!");
    await primary(page, /^Continue/u).click();

    await expect(page.getByText("Reading it")).toBeVisible();
    await primary(page, /^Next/u).click();
    await rightOption.click();
    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Correct!");
    await primary(page, /^Continue/u).click();

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    await expect
      .poll(() =>
        prisma.learningEvent.findFirst({
          select: { correctAnswers: true },
          where: { endedAt: { not: null }, userId: noProgressUser.id },
        }),
      )
      .toStrictEqual({ correctAnswers: 2 });

    expect(await attempts()).toBe(1);
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
