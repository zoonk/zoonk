import { randomUUID } from "node:crypto";
import { getAiOrganization, revalidateCacheTags } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { cacheTagCoursesList } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const UUID_SHORT_LENGTH = 8;

async function createPublishedCourse(language: string) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
  const title = `E2E Course ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId: org.id,
    slug: `e2e-courses-${uniqueId}`,
    title,
  });

  // Course needs a chapter so the detail page renders instead of redirecting
  await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
  });

  await revalidateCacheTags(
    [cacheTagCoursesList({ language })],
    [`/${language === "en" ? "" : `${language}/`}courses`],
  );

  return course;
}

test.describe("Courses Page - Basic", () => {
  test("clicking course card navigates to course detail", async ({ page }) => {
    const course = await createPublishedCourse("en");

    await page.goto("/courses");

    await expect(page.getByRole("heading", { name: /explore courses/i })).toBeVisible();

    const courseLink = page.getByRole("link", { name: new RegExp(course.title, "i") });
    await expect(courseLink).toBeVisible();

    await courseLink.click();

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/${course.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  });
});

test.describe("Courses Page - Locale", () => {
  test("Portuguese locale shows translated content", async ({ page }) => {
    await page.goto("/pt/courses");

    await expect(page.getByRole("heading", { name: /explorar cursos/i })).toBeVisible();
  });

  test("unpublished courses are hidden", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
    const title = `E2E Curso Não Publicado ${uniqueId}`;

    const unpublishedCourse = await courseFixture({
      isPublished: false,
      language: "pt",
      normalizedTitle: normalizeString(title),
      organizationId: org.id,
      slug: `e2e-unpublished-${uniqueId}`,
      title,
    });

    await page.goto("/pt/courses");

    await expect(page.getByText(unpublishedCourse.title)).not.toBeVisible();
  });
});
