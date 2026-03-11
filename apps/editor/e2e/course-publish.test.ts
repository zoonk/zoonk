import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

async function createTestCourse(isPublished: boolean) {
  const org = await getAiOrganization();

  return courseFixture({
    isPublished,
    organizationId: org.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/${AI_ORG_SLUG}/c/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
}

test.describe("Course Publish Toggle", () => {
  test("displays Draft for unpublished course", async ({ authenticatedPage }) => {
    const course = await createTestCourse(false);
    await navigateToCoursePage(authenticatedPage, course.slug);

    const publishToggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: publishToggle });
    await expect(publishLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(publishToggle).not.toBeChecked();
  });

  test("displays Published for published course", async ({ authenticatedPage }) => {
    const course = await createTestCourse(true);
    await navigateToCoursePage(authenticatedPage, course.slug);

    const publishToggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: publishToggle });
    await expect(publishLabel.getByText(/^published$/i)).toBeVisible();
    await expect(publishToggle).toBeChecked();
  });

  test("publishes a draft course and persists", async ({ authenticatedPage }) => {
    const course = await createTestCourse(false);
    await navigateToCoursePage(authenticatedPage, course.slug);

    const toggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: toggle });

    await expect(publishLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();

    await toggle.click();

    await expect(publishLabel.getByText(/^published$/i)).toBeVisible();
    await expect(toggle).toBeChecked();

    await expect(async () => {
      const record = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
      expect(record.isPublished).toBe(true);
    }).toPass({ timeout: 10_000 });
  });

  test("publishes all child content when publishing a draft course", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse(false);
    const orgId = course.organizationId;
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId: orgId,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: orgId,
    });
    const activity = await activityFixture({
      isPublished: false,
      lessonId: lesson.id,
      organizationId: orgId,
    });
    const step = await stepFixture({ activityId: activity.id, isPublished: false });

    await navigateToCoursePage(authenticatedPage, course.slug);

    const toggle = authenticatedPage.getByRole("switch");
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();

    await expect(async () => {
      const [dbChapter, dbLesson, dbActivity, dbStep] = await Promise.all([
        prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
        prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
        prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
        prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
      ]);

      expect(dbChapter.isPublished).toBe(true);
      expect(dbLesson.isPublished).toBe(true);
      expect(dbActivity.isPublished).toBe(true);
      expect(dbStep.isPublished).toBe(true);
    }).toPass({ timeout: 10_000 });
  });

  test("unpublishes a published course and persists", async ({ authenticatedPage }) => {
    const course = await createTestCourse(true);
    await navigateToCoursePage(authenticatedPage, course.slug);

    const toggle = authenticatedPage.getByRole("switch");
    const publishLabel = authenticatedPage.locator("label").filter({ has: toggle });

    await expect(publishLabel.getByText(/^published$/i)).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeChecked();

    await toggle.click();

    await expect(publishLabel.getByText(/^draft$/i)).toBeVisible();
    await expect(toggle).not.toBeChecked();

    await expect(async () => {
      const record = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
      expect(record.isPublished).toBe(false);
    }).toPass({ timeout: 10_000 });
  });
});
