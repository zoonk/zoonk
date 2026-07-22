import { randomUUID } from "node:crypto";
import { instant } from "@next/playwright";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

test.describe("Instant navigation", () => {
  test("shows the cached learn page during navigation", async ({ page }) => {
    await page.goto("/start");
    await page.waitForLoadState("networkidle");

    const learnLink = page.getByRole("link", { name: /learn something/iu });
    await expect(learnLink).toBeVisible();

    await instant(page, async () => {
      await learnLink.click();

      await expect(page).toHaveURL(/\/start\/learn$/u);

      await expect(
        page.getByRole("heading", { name: /what do you want to learn/iu }),
      ).toBeVisible();
    });
  });

  test("shows a runtime-prefetched chapter during navigation", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await getAiOrganization();
    const courseTitle = `E2E Instant Course ${uniqueId}`;
    const chapterTitle = `E2E Instant Chapter ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(courseTitle),
      organizationId: organization.id,
      slug: `e2e-instant-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      slug: `e2e-instant-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const courseUrl = `/b/${organization.slug}/c/${course.slug}`;
    const chapterUrl = `${courseUrl}/ch/${chapter.slug}`;

    await page.goto(courseUrl);
    await page.waitForLoadState("networkidle");

    const chapterLink = page.getByRole("link", { name: new RegExp(chapterTitle, "u") });
    await expect(chapterLink).toBeVisible();

    await instant(page, async () => {
      await chapterLink.click();

      await expect(page).toHaveURL(chapterUrl);

      await expect(
        page.getByRole("heading", { exact: true, level: 1, name: `1. ${chapterTitle}` }),
      ).toBeVisible();
    });
  });

  test("shows a runtime-prefetched lesson during navigation", async ({ authenticatedPage }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await getAiOrganization();
    const courseTitle = `E2E Instant Lesson Course ${uniqueId}`;
    const chapterTitle = `E2E Instant Lesson Chapter ${uniqueId}`;
    const lessonTitle = `E2E Instant Lesson ${uniqueId}`;
    const stepTitle = `E2E Instant Step ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(courseTitle),
      organizationId: organization.id,
      slug: `e2e-instant-lesson-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      slug: `e2e-instant-lesson-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      slug: `e2e-instant-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    await stepFixture({
      content: { text: `E2E instant content ${uniqueId}`, title: stepTitle, variant: "text" },
      isPublished: true,
      lessonId: lesson.id,
    });

    const chapterUrl = `/b/${organization.slug}/c/${course.slug}/ch/${chapter.slug}`;
    const lessonUrl = `${chapterUrl}/l/${lesson.slug}`;

    await authenticatedPage.goto(chapterUrl);
    await authenticatedPage.waitForLoadState("networkidle");

    const lessonLink = authenticatedPage.getByRole("link", { name: new RegExp(lessonTitle, "u") });
    await expect(lessonLink).toBeVisible();

    await instant(authenticatedPage, async () => {
      await lessonLink.click();

      await expect(authenticatedPage).toHaveURL(lessonUrl);
      await expect(authenticatedPage.getByRole("heading", { name: stepTitle })).toBeVisible();
    });
  });
});
