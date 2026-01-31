import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { type Page, expect, test } from "./fixtures";

async function createTestCourse() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  return courseFixture({
    organizationId: org.id,
    slug: `e2e-cat-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/ai/c/en/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
}

async function openCategoryPopover(page: Page) {
  await page.getByRole("button", { name: /add category/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

function getCategoryOption(page: Page, name: RegExp) {
  const dialog = page.getByRole("dialog");
  return dialog.getByText(name);
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

  test("adds a category and persists after reload", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    await openCategoryPopover(authenticatedPage);
    await getCategoryOption(authenticatedPage, /technology/i).click();

    const addButton = authenticatedPage.getByRole("button", {
      name: /add category/i,
    });

    await expect(addButton).toBeEnabled();

    await authenticatedPage.keyboard.press("Escape");
    await expect(authenticatedPage.getByRole("dialog")).not.toBeVisible();

    const main = authenticatedPage.getByRole("main");
    await expect(main.getByText("Technology")).toBeVisible();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    await expect(main.getByText("Technology")).toBeVisible();
  });

  test("removes a category and persists after reload", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    await courseCategoryFixture({ category: "tech", courseId: course.id });

    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(authenticatedPage.getByText("Technology")).toBeVisible();

    await openCategoryPopover(authenticatedPage);
    await getCategoryOption(authenticatedPage, /technology/i).click();

    const addButton = authenticatedPage.getByRole("button", {
      name: /add category/i,
    });
    await expect(addButton).toBeEnabled();

    await authenticatedPage.keyboard.press("Escape");

    await expect(authenticatedPage.getByText("Technology")).not.toBeVisible();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText("Technology")).not.toBeVisible();
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

    await authenticatedPage.goto(`/ai/c/en/${course.slug}`);

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

    await expect(authenticatedPage.getByText("Technology")).not.toBeVisible();
    await expect(authenticatedPage.getByText("Arts")).toBeVisible();
    await expect(authenticatedPage.getByText("Science")).toBeVisible();
    await expect(authenticatedPage.getByText("Math")).toBeVisible();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText("Technology")).not.toBeVisible();
    await expect(authenticatedPage.getByText("Arts")).toBeVisible();
    await expect(authenticatedPage.getByText("Science")).toBeVisible();
    await expect(authenticatedPage.getByText("Math")).toBeVisible();
  });

  // Track a regression where the category is not selected after the server action completes
  test("keeps category selected after server action completes - regression", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse();
    await navigateToCoursePage(authenticatedPage, course.slug);

    await openCategoryPopover(authenticatedPage);

    // Click the category option to select it
    await getCategoryOption(authenticatedPage, /technology/i).click();

    // Wait for the add button to be enabled (indicates transition completed)
    const addButton = authenticatedPage.getByRole("button", {
      name: /add category/i,
    });

    await expect(addButton).toBeEnabled();

    // Close the popover and wait for it to close
    await authenticatedPage.keyboard.press("Escape");
    await expect(authenticatedPage.getByRole("dialog")).not.toBeVisible();

    // Verify the badge is still visible after transition completed
    // This is the key assertion - if revalidatePath is missing,
    // The optimistic update reverts and the badge disappears
    const main = authenticatedPage.getByRole("main");
    await expect(main.getByText("Technology")).toBeVisible();

    // Verify persistence
    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText("Technology")).toBeVisible();
  });
});
