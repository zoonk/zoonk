import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { expect, test } from "./fixtures";

async function createTestCourseWithActivity() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-ca-course-${uniqueId}`,
    title: `E2E CA Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-ca-ch-${uniqueId}`,
    title: `E2E CA Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-ca-l-${uniqueId}`,
    title: `E2E CA Lesson ${uniqueId}`,
  });

  await activityFixture({
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E CA Activity ${uniqueId}`,
  });

  return { chapter, course, lesson };
}

/**
 * Open the "more options" dropdown, retrying the click if the page
 * hasn't hydrated yet (SSR'd button visible but no event handler).
 */
async function openMoreOptions(page: Page) {
  const trigger = page.getByRole("button", { name: /more options/i });
  const menuItem = page.getByRole("button", { name: /send feedback/i });

  await expect(async () => {
    if (!(await menuItem.isVisible())) {
      await trigger.click();
    }

    await expect(menuItem).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test.describe("Catalog Actions", () => {
  test("course page shows actions button", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await expect(page.getByRole("button", { name: /more options/i })).toBeVisible();
  });

  test("dropdown opens with feedback item", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await expect(page.getByRole("button", { name: /send feedback/i })).toBeVisible();
  });

  test("feedback dialog opens from dropdown", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await page.getByRole("button", { name: /send feedback/i }).click();

    await expect(page.getByRole("heading", { name: /feedback/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /message/i })).toBeVisible();
  });

  test("chapter page has actions button", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    await expect(page.getByRole("button", { name: /more options/i })).toBeVisible();
  });

  test("lesson page has actions button", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("button", { name: /more options/i })).toBeVisible();
  });

  test("dropdown shows feedback items on course page", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await expect(page.getByRole("menuitemradio", { name: /^helpful$/i })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /not helpful/i })).toBeVisible();
  });

  test("clicking helpful shows toast confirmation", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await page.getByRole("menuitemradio", { name: /^helpful$/i }).click();

    await expect(page.getByText(/thanks for your feedback/i)).toBeVisible();
  });

  test("clicking helpful marks it as selected", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await page.getByRole("menuitemradio", { name: /^helpful$/i }).click();

    await expect(page.getByRole("menuitemradio", { name: /^helpful$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("switching feedback changes selection", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await page.getByRole("menuitemradio", { name: /^helpful$/i }).click();
    await page.getByRole("menuitemradio", { name: /not helpful/i }).click();

    await expect(page.getByRole("menuitemradio", { name: /not helpful/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("menuitemradio", { name: /^helpful$/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("chapter page shows feedback items", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    await openMoreOptions(page);
    await expect(page.getByRole("menuitemradio", { name: /^helpful$/i })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /not helpful/i })).toBeVisible();
  });

  test("lesson page shows feedback items", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await openMoreOptions(page);
    await expect(page.getByRole("menuitemradio", { name: /^helpful$/i })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /not helpful/i })).toBeVisible();
  });

  test("send feedback dialog still works after selecting feedback", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    await openMoreOptions(page);
    await page.getByRole("menuitemradio", { name: /^helpful$/i }).click();
    await page.getByRole("button", { name: /send feedback/i }).click();

    await expect(page.getByRole("heading", { name: /feedback/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /message/i })).toBeVisible();
  });
});
