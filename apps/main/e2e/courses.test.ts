import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, test } from "./fixtures";

async function createUnpublishedCourse() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  return courseFixture({
    isPublished: false,
    language: "pt",
    organizationId: org.id,
    slug: `e2e-unpublished-${randomUUID().slice(0, 8)}`,
    title: `Curso Não Publicado ${randomUUID().slice(0, 8)}`,
  });
}

test.describe("Courses Page - Basic", () => {
  test("shows page content with course cards", async ({ page }) => {
    await page.goto("/courses");

    // Page title and description
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/start learning something new today/i),
    ).toBeVisible();

    await expect(page.getByText("Machine Learning").first()).toBeVisible();
  });

  test("clicking course card navigates to course detail", async ({ page }) => {
    await page.goto("/courses");

    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();

    // Use exact text match to avoid matching courses where "machine learning"
    // appears in the description (e.g., Data Science course)
    const courseLink = page
      .getByRole("link")
      .filter({ has: page.getByText("Machine Learning", { exact: true }) })
      .first();

    await expect(courseLink).toBeVisible();
    await courseLink.click();

    await page.waitForURL(/\/b\/ai\/c\/machine-learning/);

    await expect(
      page.getByRole("heading", { level: 1, name: /machine learning/i }),
    ).toBeVisible();
  });
});

test.describe("Courses Page - Locale", () => {
  test("Portuguese locale shows translated content", async ({ page }) => {
    await page.goto("/pt/courses");

    // Page title should be translated
    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();

    await expect(page.getByText("Machine Learning").first()).toBeVisible();
  });

  test("unpublished courses are hidden", async ({ page }) => {
    const course = await createUnpublishedCourse();
    await page.goto("/pt/courses");

    // Wait for page to load with expected content
    await expect(page.getByText("Machine Learning").first()).toBeVisible();

    // Unpublished course should NOT be visible
    await expect(page.getByText(course.title)).not.toBeVisible();
  });
});
