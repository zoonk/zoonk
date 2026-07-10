import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

type ScrollTarget = { title: string; url: string };
type LessonProgressSetup = "completedPrevious" | "startedOnly";

const ACTIVE_SCROLL_VIEWPORT = { height: 667, width: 375 };
const SCROLL_TARGET_TOP_OFFSET = 180;

/**
 * The floating action changes after a real scroll event, so tests use the
 * browser scroll API instead of reaching into React state.
 */
async function scrollDown(page: Page) {
  await page.evaluate(() => globalThis.scrollBy({ behavior: "auto", top: 700 }));
}

/**
 * Passing the active item should make the current-item shortcut disappear
 * because jumping back down to content the learner already crossed is
 * disorienting; the floating action should become a recovery path upward.
 */
async function scrollPastCatalogTarget({ page, title }: { page: Page; title: string }) {
  const targetTop = await getCatalogLinkTop({ page, title });

  await page.evaluate(
    (scrollDistance) => globalThis.scrollBy({ behavior: "auto", top: scrollDistance }),
    targetTop + 260,
  );

  await expect.poll(() => getCatalogLinkTop({ page, title })).toBeLessThan(0);
}

/**
 * Semantic link lookup keeps these scroll assertions tied to what a learner can
 * see and activate, while still letting the test inspect the rendered position.
 */
async function getCatalogLinkTop({ page, title }: { page: Page; title: string }) {
  return page
    .getByRole("link", { name: new RegExp(title, "u") })
    .evaluate((element) => element.getBoundingClientRect().top);
}

/**
 * The current-item action scrolls to a tile near the top of the viewport, but
 * leaves enough room for the sticky catalog navigation.
 */
async function expectTargetNearTop({ page, title }: { page: Page; title: string }) {
  await expect
    .poll(() => getCatalogLinkTop({ page, title }))
    .toBeLessThanOrEqual(SCROLL_TARGET_TOP_OFFSET);
}

/**
 * Smooth scrolling is browser behavior, so the focused assertion records the
 * options passed to scrollIntoView instead of trying to time animation frames.
 */
async function recordScrollIntoViewOptions(page: Page) {
  await page.addInitScript(() => {
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- Playwright init scripts need browser-side patches inside the serialized callback.
    Element.prototype.scrollIntoView = function scrollIntoView(
      options?: boolean | ScrollIntoViewOptions,
    ) {
      Object.assign(globalThis, { catalogScrollIntoViewOptions: options });
    };
  });
}

/**
 * Toolbar shortcuts should animate for users who have not asked the browser to
 * reduce motion.
 */
async function expectSmoothScrollRequest(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const options: unknown = Reflect.get(globalThis, "catalogScrollIntoViewOptions");

        if (!options || typeof options !== "object") {
          return null;
        }

        const behavior: unknown = Reflect.get(options, "behavior");

        return typeof behavior === "string" ? behavior : null;
      }),
    )
    .toBe("smooth");
}

/**
 * Course pages need enough chapters to make the active chapter useful as a
 * shortcut. The completed lesson sits just before the active chapter, while a
 * later opened lesson proves incomplete progress does not move the target.
 */
async function createScrollableCourseTarget({
  userId,
}: {
  userId?: string;
}): Promise<ScrollTarget> {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const activeChapterIndex = userId ? 10 : 0;

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-active-scroll-course-${uniqueId}`,
    title: `E2E Active Scroll Course ${uniqueId}`,
  });

  const chapters = await Promise.all(
    Array.from({ length: 14 }, (_, position) =>
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position,
        slug: `e2e-active-scroll-ch-${position}-${uniqueId}`,
        title: `E2E Active Scroll Chapter ${position + 1} ${uniqueId}`,
      }),
    ),
  );

  const lessons = await Promise.all(
    chapters.map((chapter, position) =>
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        title: `E2E Active Scroll Lesson ${position + 1} ${uniqueId}`,
      }),
    ),
  );

  const activeChapter = chapters[activeChapterIndex];
  const completedLesson = lessons[activeChapterIndex - 1];
  const startedLesson = lessons[activeChapterIndex + 1];

  if (!activeChapter || (userId && (!completedLesson || !startedLesson))) {
    throw new Error("Active scroll course fixture did not create enough chapters.");
  }

  if (userId && completedLesson && startedLesson) {
    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId,
      }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: startedLesson.id,
        userId,
      }),
    ]);
  }

  return { title: activeChapter.title, url: `/b/${AI_ORG_SLUG}/c/${course.slug}` };
}

/**
 * Chapter pages need a long lesson list so the active lesson target proves the
 * floating action can jump deeper into the chapter.
 */
async function createScrollableLessonTarget({
  progressSetup = "completedPrevious",
  userId,
}: {
  progressSetup?: LessonProgressSetup;
  userId: string;
}): Promise<ScrollTarget> {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const activeLessonIndex = 11;

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-active-scroll-lessons-course-${uniqueId}`,
    title: `E2E Active Scroll Lessons Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-active-scroll-lessons-ch-${uniqueId}`,
    title: `E2E Active Scroll Lessons Chapter ${uniqueId}`,
  });

  const lessons = await Promise.all(
    Array.from({ length: 16 }, (_, position) =>
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: org.id,
        position,
        title: `E2E Active Scroll Lesson ${position + 1} ${uniqueId}`,
      }),
    ),
  );

  const activeLesson = lessons[activeLessonIndex];
  const completedLesson = lessons[activeLessonIndex - 1];

  if (!activeLesson || !completedLesson) {
    throw new Error("Active scroll lesson fixture did not create enough lessons.");
  }

  if (progressSetup === "completedPrevious") {
    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId,
    });
  }

  if (progressSetup === "startedOnly") {
    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: null,
      lessonId: activeLesson.id,
      userId,
    });
  }

  return {
    title: activeLesson.title ?? "",
    url: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`,
  };
}

test.describe("Catalog Active Scroll", () => {
  test.use({ viewport: ACTIVE_SCROLL_VIEWPORT });

  test("course page jumps to the current chapter while scrolling down", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const target = await createScrollableCourseTarget({ userId: withProgressUser.id });

    await authenticatedPage.emulateMedia({ reducedMotion: "reduce" });
    await authenticatedPage.goto(target.url);
    await expect(authenticatedPage.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(
      authenticatedPage.getByRole("link", { name: new RegExp(target.title, "u") }),
    ).toBeVisible();

    await scrollDown(authenticatedPage);

    const currentChapterLink = authenticatedPage.getByRole("link", { name: /^current chapter$/iu });
    await expect(currentChapterLink).toBeVisible();

    await currentChapterLink.click();
    await expectTargetNearTop({ page: authenticatedPage, title: target.title });
  });

  test("course page toolbar jumps to the current chapter", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const target = await createScrollableCourseTarget({ userId: withProgressUser.id });

    await authenticatedPage.emulateMedia({ reducedMotion: "reduce" });
    await authenticatedPage.goto(target.url);
    await expect(authenticatedPage.getByRole("heading", { level: 1 })).toBeVisible();

    const currentChapterLink = authenticatedPage.getByRole("link", {
      name: /^go to current chapter$/iu,
    });

    await expect(currentChapterLink).toBeVisible();

    await currentChapterLink.click();
    await expectTargetNearTop({ page: authenticatedPage, title: target.title });
  });

  test("course page toolbar uses smooth scrolling", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const target = await createScrollableCourseTarget({ userId: withProgressUser.id });

    await recordScrollIntoViewOptions(authenticatedPage);
    await authenticatedPage.goto(target.url);
    await expect(authenticatedPage.getByRole("heading", { level: 1 })).toBeVisible();

    await authenticatedPage.getByRole("link", { name: /^go to current chapter$/iu }).click();

    await expectSmoothScrollRequest(authenticatedPage);
  });

  test("course page keeps back-to-top when no chapter is active", async ({
    userWithoutProgress,
  }) => {
    const target = await createScrollableCourseTarget({});

    await userWithoutProgress.emulateMedia({ reducedMotion: "reduce" });
    await userWithoutProgress.goto(target.url);
    await expect(userWithoutProgress.getByRole("heading", { level: 1 })).toBeVisible();

    await scrollDown(userWithoutProgress);

    await expect(userWithoutProgress.getByRole("link", { name: /back to top/iu })).toBeVisible();
    const currentChapterLink = userWithoutProgress.getByRole("link", { name: /current chapter/iu });
    await expect(currentChapterLink).toHaveCount(0);
  });

  test("chapter page switches between current lesson and back-to-top actions", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const target = await createScrollableLessonTarget({ userId: withProgressUser.id });

    await authenticatedPage.emulateMedia({ reducedMotion: "reduce" });
    await authenticatedPage.goto(target.url);
    await expect(authenticatedPage.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(
      authenticatedPage.getByRole("link", { name: new RegExp(target.title, "u") }),
    ).toBeVisible();

    await scrollDown(authenticatedPage);

    const currentLessonLink = authenticatedPage.getByRole("link", { name: /^current lesson$/iu });
    await expect(currentLessonLink).toBeVisible();

    await currentLessonLink.click();
    await expectTargetNearTop({ page: authenticatedPage, title: target.title });

    await scrollPastCatalogTarget({ page: authenticatedPage, title: target.title });

    const backToTopAfterPassingLink = authenticatedPage.getByRole("link", {
      name: /back to top/iu,
    });

    await expect(backToTopAfterPassingLink).toBeVisible();

    await expect(authenticatedPage.getByRole("link", { name: /^current lesson$/iu })).toHaveCount(
      0,
    );

    await backToTopAfterPassingLink.click();
    await expect.poll(() => authenticatedPage.evaluate(() => globalThis.scrollY)).toBe(0);
  });

  test("chapter page toolbar jumps to the current lesson", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const target = await createScrollableLessonTarget({ userId: withProgressUser.id });

    await authenticatedPage.emulateMedia({ reducedMotion: "reduce" });
    await authenticatedPage.goto(target.url);
    await expect(authenticatedPage.getByRole("heading", { level: 1 })).toBeVisible();

    const currentLessonLink = authenticatedPage.getByRole("link", {
      name: /^go to current lesson$/iu,
    });

    await expect(currentLessonLink).toBeVisible();

    await currentLessonLink.click();
    await expectTargetNearTop({ page: authenticatedPage, title: target.title });
  });

  test("chapter page keeps back-to-top when only opened lesson is incomplete", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const target = await createScrollableLessonTarget({
      progressSetup: "startedOnly",
      userId: withProgressUser.id,
    });

    await authenticatedPage.emulateMedia({ reducedMotion: "reduce" });
    await authenticatedPage.goto(target.url);
    await expect(authenticatedPage.getByRole("heading", { level: 1 })).toBeVisible();

    await scrollDown(authenticatedPage);

    await expect(authenticatedPage.getByRole("link", { name: /back to top/iu })).toBeVisible();
    const currentLessonLink = authenticatedPage.getByRole("link", { name: /current lesson/iu });
    await expect(currentLessonLink).toHaveCount(0);
  });
});
