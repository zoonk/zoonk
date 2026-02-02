import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

async function createUnpublishedCourse() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);
  const title = `E2E Curso Não Publicado ${uniqueId}`;

  return courseFixture({
    isPublished: false,
    language: "pt",
    normalizedTitle: normalizeString(title),
    organizationId: org.id,
    slug: `e2e-unpublished-${uniqueId}`,
    title,
  });
}

test.describe("Courses Page - Basic", () => {
  test("clicking course card navigates to course detail", async ({ page }) => {
    await page.goto("/courses");

    await expect(page.getByRole("heading", { name: /explore courses/i })).toBeVisible();

    // Get the first course link (order is non-deterministic, so we don't target a specific course)
    const courseLink = page.getByRole("list").getByRole("link").first();
    await expect(courseLink).toBeVisible();

    // Get the href to extract the course slug for verification
    const href = await courseLink.getAttribute("href");
    const courseSlugMatch = href?.match(/\/c\/([\w-]+)/);
    const courseSlug = courseSlugMatch?.[1] ?? "";

    await courseLink.click();

    // Verify we navigated to the course detail page
    await expect(page).toHaveURL(new RegExp(`/c/${courseSlug}$`));

    // Verify the page rendered successfully with a course heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Courses Page - Locale", () => {
  test("Portuguese locale shows translated content", async ({ page }) => {
    await page.goto("/pt/courses");

    // Page title should be translated
    await expect(page.getByRole("heading", { name: /explorar cursos/i })).toBeVisible();

    // "Inglês" is a seeded PT course with unique title that should be visible in the courses list
    await expect(page.getByRole("link", { name: /^Inglês/i })).toBeVisible();
  });

  test("unpublished courses are hidden", async ({ page }) => {
    const unpublishedCourse = await createUnpublishedCourse();
    await page.goto("/pt/courses");

    // Wait for page to load - verify a seeded PT course is visible
    await expect(page.getByRole("link", { name: /^Inglês/i })).toBeVisible();

    // Unpublished course should NOT be visible
    await expect(page.getByText(unpublishedCourse.title)).not.toBeVisible();
  });
});
