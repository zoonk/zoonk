import { type Browser, type Request, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { type E2EUser } from "@zoonk/e2e/fixtures/users";
import { planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { createGoalLearner } from "./checkpoint-fixtures";
import { type Page, expect, test } from "./fixtures";

/**
 * Answers, grades and recordings go to the app's own routes instead of Server Actions: they run
 * side by side (a typed answer's grade doesn't wait for the answer saved before it), never
 * re-render the page, and only the app's own pages may send them. A screen's own answers still go
 * one after another, so the server records them in the order they were given. Pages that show what
 * an answer changed still show it after the learner leaves a lesson halfway, even when its save was
 * still on its way or its response never arrived.
 */

const QUESTION = 'What does the electron "cloud" show?';
const RIGHT_OPTION = "Where the electron is most likely to be found";
const WRONG_OPTION = "The electron's exact path";
const RIGHT_TYPED = "It shows where the electron is likely to be";
const ATTACKER_ORIGIN = "https://attacker.example";

function primary(page: Page, label: RegExp) {
  return page.getByRole("button", { name: label });
}

async function expectVerdict(page: Page, verdict: string) {
  await expect(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

function isCheck(request: Request) {
  return request.method() === "POST" && /\/api\/steps\/[^/]+\/checks$/u.test(request.url());
}

/** A Server Action, or the page reading itself again (a refresh or an action's re-render). */
function isPageRender(request: Request, lessonId: string) {
  const { pathname } = new URL(request.url());
  const headers = request.headers();

  return (
    Boolean(headers["next-action"]) ||
    (pathname.endsWith(`/learn/${lessonId}`) &&
      headers.rsc === "1" &&
      !headers["next-router-prefetch"])
  );
}

/** Holds the first answer's save, like a slow server, until `release`. */
async function holdFirstCheck(page: Page) {
  const held: Route[] = [];

  await page.route("**/api/steps/*/checks", async (route) => {
    if (held.length === 0) {
      held.push(route);
      return;
    }

    await route.fallback();
  });

  return { release: () => Promise.all(held.map((route) => route.fallback())) };
}

/** The answer's response never arrives, though the server saved it: the browser sees a failure. */
async function loseCheckResponses(page: Page) {
  await page.route("**/api/steps/*/checks", async (route) => {
    await route.fetch();
    await route.abort();
  });
}

/**
 * A learner whose plan has a chapter with one lesson (a check) on a skill of their goal, so a miss
 * in it lands in their mistakes notebook.
 */
async function createNotebookLearner(browser: Browser) {
  const { goal, user } = await createGoalLearner();

  const [plan, chapter, skill, playable] = await Promise.all([
    planFixture({ goalId: goal.id }),
    libraryChapterFixture({ title: "Inside the atom" }),
    skillFixture(),
    playableLessonFixture({ lesson: { title: "Why the electron doesn't fall" }, steps: ["check"] }),
  ]);

  const { lesson } = playable;

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    planItemFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: new Date(Date.now() + 7 * MS_PER_DAY),
    }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
  ]);

  const page = await openLearner({ browser, lessonId: lesson.id, user });
  return { chapterId: chapter.id, lesson, page, user };
}

/** Opens the learner's browser, with the lesson's readiness check (the separate API's) answered. */
async function openLearner({
  browser,
  lessonId,
  user,
}: {
  browser: Browser;
  lessonId: string;
  user: E2EUser;
}) {
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  await page.route(`**/v1/library/lessons/${lessonId}/generations`, (route) =>
    route.fulfill({ body: JSON.stringify({ status: "ready" }), contentType: "application/json" }),
  );

  return page;
}

test.describe("Answer transports", () => {
  test("saves answers side by side, without a Server Action or a page render", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["check", "typedAnswer"] });
    const renders: string[] = [];
    const checks: string[] = [];

    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText(QUESTION)).toBeVisible();
    const save = await holdFirstCheck(page);

    page.on("request", (request) => {
      if (isPageRender(request, lesson.id)) {
        renders.push(request.url());
      }

      if (isCheck(request)) {
        checks.push(request.url());
      }
    });

    // The check is graded on the device at once; its save waits on a slow server.
    await page.getByRole("radio", { name: RIGHT_OPTION }).click();
    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Correct!");
    await primary(page, /^Continue/u).click();

    // The typed answer's grade goes out and comes back while that save is still on its way.
    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(RIGHT_TYPED);

    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Correct!");
    expect(checks).toHaveLength(2);

    await save.release();
    await expect.poll(() => prisma.attempt.count({ where: { userId: noProgressUser.id } })).toBe(2);

    // Answering never re-rendered the lesson; only its completion runs a Server Action.
    expect(renders).toStrictEqual([]);

    await primary(page, /^Continue/u).click();
    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
  });

  for (const save of ["saved", "still on its way", "saved without a response"] as const) {
    test(`shows a miss in the notebook after the learner leaves the lesson halfway, its save ${save}`, async ({
      browser,
    }) => {
      const { chapterId, lesson, page, user } = await createNotebookLearner(browser);

      try {
        // The notebook as it was before the lesson, prefetched with the learner's data ("2": the
        // runtime prefetch) and kept by the browser for the next visit.
        const prefetched = page.waitForResponse((response) => {
          const request = response.request();

          return (
            new URL(request.url()).pathname.endsWith("/mistakes") &&
            request.headers()["next-router-prefetch"] === "2"
          );
        });

        await page.goto(`/content/chapters/${chapterId}`);
        const notebookLink = page.getByRole("link", { name: "Mistakes notebook" });
        await notebookLink.hover();
        await prefetched;

        await page.getByRole("link", { name: /Why the electron doesn't fall/u }).click();
        await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}$`, "u"));

        const held = save === "still on its way" ? await holdFirstCheck(page) : null;

        if (save === "saved without a response") {
          await loseCheckResponses(page);
        }

        const sent = page.waitForRequest(isCheck);
        await page.getByRole("radio", { name: WRONG_OPTION }).click();
        await primary(page, /^Check/u).click();
        await expectVerdict(page, "Not quite");
        await sent;

        if (save !== "still on its way") {
          await expect.poll(() => prisma.mistake.count({ where: { userId: user.id } })).toBe(1);
        }

        await page.getByRole("link", { name: "Close lesson" }).click();
        await expect(page).toHaveURL(new RegExp(`/content/chapters/${chapterId}$`, "u"));

        // The save lands after the lesson closed.
        await held?.release();

        await notebookLink.click();
        await expect(page).toHaveURL(/\/mistakes$/u);
        // The lesson stays in the document, hidden: only the notebook's copy counts.
        await expect(page.getByText(QUESTION).filter({ visible: true })).toBeVisible();

        await expect.poll(() => prisma.mistake.count({ where: { userId: user.id } })).toBe(1);
      } finally {
        await page.context().close();
      }
    });
  }

  test("records a screen's answers in the order they were given, so a slow miss stays its first", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["check"] });
    const sent: unknown[] = [];

    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText(QUESTION)).toBeVisible();
    const save = await holdFirstCheck(page);

    page.on("request", (request) => {
      if (isCheck(request)) {
        sent.push(request.postDataJSON());
      }
    });

    const missSent = page.waitForRequest(isCheck);
    await page.getByRole("radio", { name: WRONG_OPTION }).click();
    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Not quite");
    await missSent;
    await primary(page, /^Continue/u).click();

    // The miss comes back at the end and is answered right while its save is still on its way.
    await page.getByRole("radio", { name: RIGHT_OPTION }).click();
    await primary(page, /^Check/u).click();
    await expectVerdict(page, "Correct!");
    expect(sent).toHaveLength(1);

    await save.release();

    await expect
      .poll(() =>
        prisma.attempt.findMany({
          orderBy: { answeredAt: "asc" },
          select: { isCorrect: true },
          where: { userId: noProgressUser.id },
        }),
      )
      .toStrictEqual([{ isCorrect: false }, { isCorrect: true }]);

    await primary(page, /^Continue/u).click();
    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    // The run counts the miss, the screen's first answer, and not the right answer after it.
    await expect
      .poll(() =>
        prisma.learningEvent.findFirst({
          select: { correctAnswers: true, incorrectAnswers: true },
          where: { endedAt: { not: null }, userId: noProgressUser.id },
        }),
      )
      .toStrictEqual({ correctAnswers: 0, incorrectAnswers: 1 });
  });

  test("refuses answers another site sends with the learner's cookies", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const id = crypto.randomUUID();

    const paths = [
      `/api/steps/${id}/checks`,
      `/api/pronunciation-reviews/${id}/answers`,
      `/api/me/mistakes/${id}/answers`,
      `/api/essays/${id}/submissions`,
      `/api/study-sessions/${id}/blocks/${id}/answers`,
    ];

    const statuses = await Promise.all(
      paths.flatMap((path) => [
        page.request
          .post(path, { data: {}, headers: { Origin: ATTACKER_ORIGIN } })
          .then((response) => response.status()),
        // A request without an Origin isn't a page of this app either.
        page.request.post(path, { data: {} }).then((response) => response.status()),
      ]),
    );

    expect(statuses).toStrictEqual(paths.flatMap(() => [403, 403]));
    await expect(prisma.attempt.count({ where: { userId: noProgressUser.id } })).resolves.toBe(0);
  });
});
