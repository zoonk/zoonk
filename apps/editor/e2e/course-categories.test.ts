import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization, openDialog } from "@zoonk/e2e/helpers";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { type Page, expect, test } from "./fixtures";

async function createTestCourse() {
  const org = await getAiOrganization();

  return courseFixture({
    organizationId: org.id,
    slug: `e2e-cat-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/${AI_ORG_SLUG}/c/en/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
}

async function openCategoryPopover(page: Page) {
  await openDialog(page.getByRole("button", { name: /add category/i }), page.getByRole("dialog"));
}

function getCategoryOption(page: Page, name: RegExp) {
  const dialog = page.getByRole("dialog");
  return dialog.getByText(name);
}

async function expectCategoryInDB(courseId: number, category: string) {
  await expect(async () => {
    const record = await prisma.courseCategory.findUnique({
      where: { courseCategory: { category, courseId } },
    });
    expect(record).not.toBeNull();
  }).toPass({ timeout: 10_000 });
}

async function expectCategoryNotInDB(courseId: number, category: string) {
  await expect(async () => {
    const record = await prisma.courseCategory.findUnique({
      where: { courseCategory: { category, courseId } },
    });
    expect(record).toBeNull();
  }).toPass({ timeout: 10_000 });
}

test.describe("Course Categories Editor", () => {
  test("displays existing categories as badges", async ({ authenticatedPage }) => {
    const course = await createTestCourse();

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course.id }),
      courseCategoryFixture({ category: "science", courseId: course.id }),
    ]);

    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(authenticatedPage.getByText("Technology")).toBeVisible();
    await expect(authenticatedPage.getByText("Science")).toBeVisible();
  });

  test("adds a category and persists", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    await openCategoryPopover(authenticatedPage);
    await getCategoryOption(authenticatedPage, /technology/i).click();
    await authenticatedPage.keyboard.press("Escape");
    await expect(authenticatedPage.getByRole("dialog")).not.toBeVisible();

    // Badge appears immediately without reload
    const main = authenticatedPage.getByRole("main");
    await expect(main.getByText("Technology")).toBeVisible();

    await expectCategoryInDB(course.id, "tech");
  });

  test("removes a category and persists", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await courseCategoryFixture({ category: "tech", courseId: course.id });

    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(authenticatedPage.getByText("Technology")).toBeVisible();

    await openCategoryPopover(authenticatedPage);
    await getCategoryOption(authenticatedPage, /technology/i).click();
    await authenticatedPage.keyboard.press("Escape");

    // Badge disappears immediately without reload
    await expect(authenticatedPage.getByText("Technology")).not.toBeVisible();

    await expectCategoryNotInDB(course.id, "tech");
  });

  test("filters categories by search", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    await openCategoryPopover(authenticatedPage);

    await expect(getCategoryOption(authenticatedPage, /technology/i)).toBeVisible();

    await expect(getCategoryOption(authenticatedPage, /science/i)).toBeVisible();

    await expect(getCategoryOption(authenticatedPage, /arts/i)).toBeVisible();

    await authenticatedPage.getByPlaceholder(/search/i).fill("tech");

    await expect(getCategoryOption(authenticatedPage, /technology/i)).toBeVisible();

    await expect(getCategoryOption(authenticatedPage, /science/i)).not.toBeVisible();

    await expect(getCategoryOption(authenticatedPage, /arts/i)).not.toBeVisible();
  });

  test("displays multiple categories in alphabetical order for non-English locale", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse();
    // Use categories with different alphabetical order in English vs Spanish:
    // English: Arts < Business < Science
    // Spanish: Artes < Ciencia < Negocios
    await courseCategoryFixture({ category: "business", courseId: course.id });
    await courseCategoryFixture({ category: "arts", courseId: course.id });
    await courseCategoryFixture({ category: "science", courseId: course.id });

    // Set Spanish locale via cookie to test UI translation ordering
    await authenticatedPage
      .context()
      .addCookies([{ domain: "localhost", name: LOCALE_COOKIE, path: "/", value: "es" }]);

    await authenticatedPage.goto(`/${AI_ORG_SLUG}/c/en/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("textbox", {
        name: /editar título del curso/i,
      }),
    ).toBeVisible();

    const main = authenticatedPage.getByRole("main");

    // Spanish alphabetical order: Artes < Ciencia < Negocios
    const artsBadge = main.getByText("Artes");
    const scienceBadge = main.getByText("Ciencia");
    const businessBadge = main.getByText("Negocios");

    await expect(artsBadge).toBeVisible();
    await expect(scienceBadge).toBeVisible();
    await expect(businessBadge).toBeVisible();

    const artsBox = await artsBadge.boundingBox();
    const scienceBox = await scienceBadge.boundingBox();
    const businessBox = await businessBadge.boundingBox();

    expect(artsBox).toBeTruthy();
    expect(scienceBox).toBeTruthy();
    expect(businessBox).toBeTruthy();

    if (!(artsBox && scienceBox && businessBox)) {
      throw new Error("Could not get bounding boxes for category badges");
    }

    // Verify Spanish alphabetical order: Artes < Ciencia < Negocios
    expect(artsBox.x).toBeLessThan(scienceBox.x);
    expect(scienceBox.x).toBeLessThan(businessBox.x);
  });

  test("handles multiple add/remove operations in one session", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await courseCategoryFixture({ category: "tech", courseId: course.id });
    await courseCategoryFixture({ category: "arts", courseId: course.id });

    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(authenticatedPage.getByText("Technology")).toBeVisible();
    await expect(authenticatedPage.getByText("Arts")).toBeVisible();

    await openCategoryPopover(authenticatedPage);

    await getCategoryOption(authenticatedPage, /technology/i).click();
    await getCategoryOption(authenticatedPage, /science/i).click();
    await getCategoryOption(authenticatedPage, /math/i).click();

    await authenticatedPage.keyboard.press("Escape");

    // All changes reflect immediately without reload
    await expect(authenticatedPage.getByText("Technology")).not.toBeVisible();
    await expect(authenticatedPage.getByText("Arts")).toBeVisible();
    await expect(authenticatedPage.getByText("Science")).toBeVisible();
    await expect(authenticatedPage.getByText("Math")).toBeVisible();

    await Promise.all([
      expectCategoryNotInDB(course.id, "tech"),
      expectCategoryInDB(course.id, "arts"),
      expectCategoryInDB(course.id, "science"),
      expectCategoryInDB(course.id, "math"),
    ]);
  });

  // Regression: optimistic update reverted after server action when revalidatePath was missing.
  // We wait for the DB write to confirm the action completed, then verify the UI didn't revert.
  test("keeps category selected after server action completes - regression", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    await openCategoryPopover(authenticatedPage);
    await getCategoryOption(authenticatedPage, /technology/i).click();
    await authenticatedPage.keyboard.press("Escape");
    await expect(authenticatedPage.getByRole("dialog")).not.toBeVisible();

    const main = authenticatedPage.getByRole("main");
    await expect(main.getByText("Technology")).toBeVisible();

    // Wait for server action to complete via DB, then verify the
    // optimistic update wasn't reverted (catches missing revalidatePath).
    await expectCategoryInDB(course.id, "tech");
    await expect(main.getByText("Technology")).toBeVisible();
  });
});
