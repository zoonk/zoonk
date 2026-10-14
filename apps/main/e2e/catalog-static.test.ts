import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

const PROGRESS_PATH = /\/api\/learner\/courses\/[^/]+\/progress/u;

/** A test-owned course with one chapter whose one lesson is written, so each page has a question. */
async function createStaticCourse() {
  const { chapters, course, organization } = await catalogCourseFixture({ lessonCounts: [0] });
  const chapter = chapters[0]!;

  const { lesson, steps } = await playableLessonFixture({
    lesson: { homeChapterId: chapter.id, title: `Static page lesson ${course.slug}` },
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });

  const coursePath = `/b/${organization.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;
  const lessonPath = `${chapterPath}/l/${lesson.slug}`;

  return { chapter, chapterPath, course, coursePath, lesson, lessonPath, steps };
}

/** A learner partway through a lesson: its run left open a minute ago, its first screen answered. */
async function startLessonRun({
  lessonId,
  stepId,
  userId,
}: {
  lessonId: string;
  stepId: string;
  userId: string;
}) {
  const run = await learningEventFixture({ contentIds: { lessonId }, seconds: 60, userId });

  await Promise.all([
    prisma.learningEvent.update({ data: { endedAt: null }, where: { id: run.id } }),
    attemptFixture({ stepId, userId }),
  ]);
}

/** Holds a page's progress reads until `release`, so the page is measured before and after. */
async function holdProgressReads(page: Page) {
  const held = Promise.withResolvers<null>();

  await page.route(PROGRESS_PATH, async (route) => {
    const response = await route.fetch();
    await held.promise;
    await route.fulfill({ response });
  });

  return { release: () => held.resolve(null) };
}

/** The words of the page as the server sent it, before any script ran (scripts left out). */
async function getServedText(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);

  const html = await response.text();

  return html
    .replaceAll(/<script[\s\S]*?<\/script>/gu, " ")
    .replaceAll(/<[^>]+>/gu, " ")
    .replaceAll(/\s+/gu, " ");
}

/** Records every request for a learner's course progress the page makes. */
function watchProgressReads(page: Page): string[] {
  const reads: string[] = [];

  page.on("request", (request) => {
    if (PROGRESS_PATH.test(request.url())) {
      reads.push(request.url());
    }
  });

  return reads;
}

async function openAsLearner(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  const context = await browser.newContext({ storageState: user.storageState });
  return { context, page: await context.newPage(), user };
}

function getTryCard(page: Page) {
  return page.getByRole("region", { name: /^Try a lesson/u });
}

/**
 * A learner's try card on a course page, measured with the progress read held (their account's
 * view settled) and again once it answers: "Continue the lesson" for one partway through the
 * lesson (`startLesson`), the question otherwise.
 */
async function measureTryCard({
  browser,
  coursePath,
  startLesson,
}: {
  browser: Browser;
  coursePath: string;
  startLesson?: (userId: string) => Promise<void>;
}) {
  const { context, page, user } = await openAsLearner(browser);

  try {
    await startLesson?.(user.id);

    const { release } = await holdProgressReads(page);
    await page.goto(coursePath);
    await expect(page.getByText("Start free, no account needed.")).toHaveCount(0);

    const card = getTryCard(page);
    const before = await card.boundingBox();
    const answered = page.waitForResponse(PROGRESS_PATH);
    release();
    await answered;

    await expect(
      startLesson
        ? card.getByRole("link", { name: "Continue the lesson" })
        : card.getByRole("button", { name: "No" }),
    ).toBeVisible();

    return { after: await card.boundingBox(), before };
  } finally {
    await context.close();
  }
}

test.describe("catalog pages and the learner's own bits", () => {
  // The page is the same for everyone: what's personal is read in the browser after it shows. A
  // server render that read the learner (their goal on the course) would put "Continue your plan"
  // in the page it sends, and couldn't be served static to everyone.
  test("serve a learner with a goal on the course the visitor's page, then show their plan's way back", async ({
    browser,
  }) => {
    const { course, coursePath } = await createStaticCourse();
    const { context, page, user } = await openAsLearner(browser);
    await goalFixture({ primaryCourseId: course.id, title: course.title, userId: user.id });

    try {
      const served = await getServedText(page, coursePath);

      expect(served).toContain("Build my plan");
      expect(served).toContain("Start free, no account needed.");
      expect(served).not.toContain("Continue your plan");

      await page.goto(coursePath);

      await expect(page.getByRole("link", { name: "Continue your plan" })).toHaveCount(2);
      await expect(page.getByRole("link", { name: "Build my plan" })).toHaveCount(0);
      await expect(page.getByText("Start free, no account needed.")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("a visitor gets the visitor's page and never reads progress", async ({ page }) => {
    const { coursePath } = await createStaticCourse();
    const reads = watchProgressReads(page);

    await page.goto(coursePath);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: "Build my plan" }).first()).toBeVisible();
    await expect(page.getByText("Start free, no account needed.").first()).toBeVisible();
    expect(reads).toStrictEqual([]);
  });

  test("a learner without a goal on the course keeps “Build my plan”, without the no-account note", async ({
    browser,
  }) => {
    const { coursePath, lesson } = await createStaticCourse();
    const { context, page } = await openAsLearner(browser);
    const reads = watchProgressReads(page);

    try {
      await page.goto(coursePath);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("link", { name: "Build my plan" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Continue your plan" })).toHaveCount(0);
      await expect(page.getByText("Start free, no account needed.")).toHaveCount(0);

      // The hero, the closing and the question share one read.
      expect(reads).toHaveLength(1);
      expect(reads[0]).toContain(`?lesson=${lesson.id}`);
    } finally {
      await context.close();
    }
  });

  // The router keeps a page it left, hidden, and shows it again on a return: what changed for the
  // learner meanwhile (a goal they started elsewhere) shows on that return.
  test("a course page shown again on Back reads the learner's bits again", async ({ browser }) => {
    const { chapter, chapterPath, course, coursePath } = await createStaticCourse();
    const { context, page, user } = await openAsLearner(browser);

    try {
      await page.goto(coursePath);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("link", { name: "Build my plan" }).first()).toBeVisible();

      await goalFixture({ primaryCourseId: course.id, title: course.title, userId: user.id });

      const band = page
        .getByRole("region", { name: "Course outline" })
        .locator("details")
        .filter({ hasText: "Beginner" });

      if ((await band.getAttribute("open")) === null) {
        await band.locator("summary").click();
      }

      await page.locator(`a[href="${chapterPath}"]:visible`).first().click();
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

      await page.goBack();

      await expect(page.getByRole("link", { name: "Continue your plan" })).toHaveCount(2);
    } finally {
      await context.close();
    }
  });

  // A read still out when the page is shown again answers for before the return: the page reads
  // again once it settles, instead of keeping that older answer.
  test("a course page shown again while its read is out reads again once it settles", async ({
    browser,
  }) => {
    const { chapter, chapterPath, course, coursePath } = await createStaticCourse();
    const { context, page, user } = await openAsLearner(browser);
    const held = Promise.withResolvers<null>();
    const reads: string[] = [];

    await page.route(PROGRESS_PATH, async (route) => {
      reads.push(route.request().url());

      if (reads.length === 1) {
        const response = await route.fetch();
        await held.promise;
        await route.fulfill({ response });
        return;
      }

      await route.continue();
    });

    try {
      await page.goto(coursePath);
      await expect.poll(() => reads.length).toBe(1);

      const band = page
        .getByRole("region", { name: "Course outline" })
        .locator("details")
        .filter({ hasText: "Beginner" });

      if ((await band.getAttribute("open")) === null) {
        await band.locator("summary").click();
      }

      await page.locator(`a[href="${chapterPath}"]:visible`).first().click();
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

      await goalFixture({ primaryCourseId: course.id, title: course.title, userId: user.id });
      await page.goBack();
      held.resolve(null);

      await expect(page.getByRole("link", { name: "Continue your plan" })).toHaveCount(2);
    } finally {
      await context.close();
    }
  });

  // "Continue the lesson" takes the question's place in the room the question holds, so a learner's
  // version arriving after the page shows moves nothing.
  test("the try card keeps its size and place when the learner's version arrives", async ({
    browser,
    page,
  }) => {
    const { coursePath, lesson, steps } = await createStaticCourse();

    await page.goto(coursePath);
    const visitorBox = await getTryCard(page).boundingBox();
    const visitorSize = { height: visitorBox?.height, width: visitorBox?.width };

    const fresh = await measureTryCard({ browser, coursePath });

    const started = await measureTryCard({
      browser,
      coursePath,
      startLesson: (userId) =>
        startLessonRun({ lessonId: lesson.id, stepId: steps[0]!.id, userId }),
    });

    for (const { after, before } of [fresh, started]) {
      expect(after).toStrictEqual(before);
      expect({ height: after?.height, width: after?.width }).toStrictEqual(visitorSize);
    }
  });

  test("a lesson page's first screen keeps its room when “Continue the lesson” takes its place", async ({
    browser,
  }) => {
    const { lesson, lessonPath, steps } = await createStaticCourse();
    const { context, page, user } = await openAsLearner(browser);
    await startLessonRun({ lessonId: lesson.id, stepId: steps[0]!.id, userId: user.id });

    try {
      const { release } = await holdProgressReads(page);
      await page.goto(lessonPath);
      await expect(page.getByText("No sign-up needed.", { exact: false })).toBeVisible();

      const article = page.getByRole("article", { name: lesson.title });
      const before = await article.boundingBox();
      release();

      await expect(article.getByRole("link", { name: "Continue the lesson" })).toBeVisible();
      expect(await article.boundingBox()).toStrictEqual(before);
    } finally {
      await context.close();
    }
  });

  test("a guest keeps the no-account note and the visitor's ways in", async ({ browser }) => {
    const { coursePath } = await createStaticCourse();
    const { context, page } = await openAsGuest(browser);

    try {
      await page.goto(coursePath);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("link", { name: "Build my plan" }).first()).toBeVisible();
      await expect(page.getByText("Start free, no account needed.").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("the progress read answers only the learner's own bits and is never cached", async ({
    browser,
    page,
  }) => {
    const { course, lesson } = await createStaticCourse();
    const path = `/api/learner/courses/${course.id}/progress?lesson=${lesson.id}`;

    const [visitor, badCourse, badLesson] = await Promise.all([
      page.request.get(path),
      page.request.get("/api/learner/courses/not-a-course/progress"),
      page.request.get(`/api/learner/courses/${course.id}/progress?lesson=nope`),
    ]);

    expect(visitor.status()).toBe(200);
    expect(visitor.headers()["cache-control"]).toBe("private, no-store");

    await expect(visitor.json()).resolves.toStrictEqual({
      followsCourse: false,
      lessonStarted: false,
    });

    expect([badCourse.status(), badLesson.status()]).toStrictEqual([400, 400]);

    const { context, page: learner, user } = await openAsLearner(browser);

    try {
      await goalFixture({ primaryCourseId: course.id, userId: user.id });
      const answer = await learner.request.get(path);

      await expect(answer.json()).resolves.toStrictEqual({
        followsCourse: true,
        lessonStarted: false,
      });
    } finally {
      await context.close();
    }
  });
});
