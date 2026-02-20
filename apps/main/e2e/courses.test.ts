import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
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

  // The courses page sorts by user count descending. Enroll multiple
  // users so this course always ranks at the top regardless of
  // accumulated test data from other runs.
  const boostCount = 50;

  const users = await Promise.all(
    Array.from({ length: boostCount }, (_, index) =>
      prisma.user.create({
        data: {
          email: `e2e-courses-${uniqueId}-${index}@zoonk.test`,
          name: `E2E Courses User ${uniqueId}-${index}`,
        },
      }),
    ),
  );

  await Promise.all(
    users.map((user) =>
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
    ),
  );

  await revalidateCacheTags(
    [cacheTagCoursesList({ language })],
    [`/${language === "en" ? "" : `${language}/`}courses`],
  );

  return course;
}

test.describe("Courses Page - Basic", () => {
  test("clicking course card navigates to course detail", async ({ page }) => {
    const course = await createPublishedCourse("en");

    const courseLink = page.getByRole("link", { name: new RegExp(course.title, "i") });

    // Cache revalidation uses background regeneration, so the first load
    // after invalidation may still serve stale content. Retry navigation
    // until the newly created course appears.
    await expect(async () => {
      await page.goto("/courses");
      await expect(courseLink).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 15_000 });

    await courseLink.click();

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/${course.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  });
});

test.describe("Courses Page - Infinite Loading", () => {
  test("loads more courses when scrolling to the bottom", async ({ page }) => {
    const org = await getAiOrganization();

    // Create 25 courses to exceed the page limit (20)
    await Promise.all(
      Array.from({ length: 25 }, () =>
        courseFixture({
          isPublished: true,
          language: "en",
          organizationId: org.id,
        }),
      ),
    );

    await revalidateCacheTags([cacheTagCoursesList({ language: "en" })], ["/courses"]);

    const courseList = page.getByRole("main").getByRole("list");
    const courseLinks = courseList.getByRole("link");

    // Wait for the courses page to load with the initial 20 items
    await expect(async () => {
      await page.goto("/courses");
      await expect(courseLinks).toHaveCount(20, { timeout: 5000 });
    }).toPass({ timeout: 15_000 });

    // Scroll to the bottom to trigger infinite loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verify more courses loaded after scrolling
    await expect(async () => {
      const count = await courseLinks.count();
      expect(count).toBeGreaterThan(20);
    }).toPass({ timeout: 10_000 });
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
