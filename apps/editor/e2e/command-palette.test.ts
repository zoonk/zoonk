import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";

async function createTestCourse() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);
  const title = `E2E Course ${uniqueId}`;

  return courseFixture({
    description: `E2E test course description ${uniqueId}`,
    isPublished: true,
    normalizedTitle: normalizeString(title),
    organizationId: org.id,
    slug: `e2e-${uniqueId}`,
    title,
  });
}

async function createTestChapter() {
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-${randomUUID().slice(0, 8)}`,
  });

  const uniqueId = randomUUID().slice(0, 8);
  const title = `E2E Chapter ${uniqueId}`;

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `E2E test chapter description ${uniqueId}`,
    isPublished: true,
    normalizedTitle: normalizeString(title),
    organizationId: org.id,
    slug: `e2e-chapter-${uniqueId}`,
    title,
  });

  return { chapter, course };
}

async function createTestLesson() {
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-${randomUUID().slice(0, 8)}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-chapter-${randomUUID().slice(0, 8)}`,
  });

  const uniqueId = randomUUID().slice(0, 8);
  const title = `E2E Lesson ${uniqueId}`;

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E test lesson description ${uniqueId}`,
    isPublished: true,
    normalizedTitle: normalizeString(title),
    organizationId: org.id,
    slug: `e2e-lesson-${uniqueId}`,
    title,
  });

  return { chapter, course, lesson };
}

async function openCommandPalette(page: Page) {
  await page.getByRole("button", { name: /search/i }).click();
}

function getModifierKey(): "Meta" | "Control" {
  return process.platform === "darwin" ? "Meta" : "Control";
}

test.describe("Command Palette - Open/Close", () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await expect(ownerPage.getByRole("button", { name: /search/i })).toBeVisible();
  });

  test("opens when clicking search button", async ({ ownerPage }) => {
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
    await ownerPage.getByRole("button", { name: /search/i }).click();
    await expect(ownerPage.getByRole("dialog")).toBeVisible();
  });

  test("toggles with Ctrl+K / Cmd+K", async ({ ownerPage }) => {
    const modifier = getModifierKey();
    await ownerPage.locator("body").click();

    // Open
    await ownerPage.keyboard.press(`${modifier}+k`);
    await expect(ownerPage.getByRole("dialog")).toBeVisible();

    // Close
    await ownerPage.keyboard.press(`${modifier}+k`);
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
  });

  test("closes on Escape", async ({ ownerPage }) => {
    await openCommandPalette(ownerPage);
    await expect(ownerPage.getByRole("dialog")).toBeVisible();

    await ownerPage.keyboard.press("Escape");
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
  });

  test("closes when clicking outside", async ({ ownerPage }) => {
    await openCommandPalette(ownerPage);
    await expect(ownerPage.getByRole("dialog")).toBeVisible();

    await ownerPage
      .locator("[data-slot='dialog-overlay']")
      .click({ force: true, position: { x: 10, y: 10 } });
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Command Palette - Static Items", () => {
  let courseUrl: string;

  test.beforeAll(async () => {
    const org = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-nav-${randomUUID().slice(0, 8)}`,
    });

    courseUrl = `/${AI_ORG_SLUG}/c/${course.slug}`;
  });

  test("shows Pages group with Home, Create course, Logout", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog.getByText("Pages")).toBeVisible();
    await expect(dialog.getByText(/home page/i)).toBeVisible();
    await expect(dialog.getByText(/create course/i)).toBeVisible();
    await expect(dialog.getByText(/^logout$/i)).toBeVisible();
  });

  test("selecting Home navigates to org home", async ({ ownerPage }) => {
    await ownerPage.goto(courseUrl);
    await openCommandPalette(ownerPage);

    await ownerPage
      .getByRole("dialog")
      .getByText(/home page/i)
      .click();

    await expect(ownerPage).toHaveURL(/\/ai$/);
  });

  test("selecting Create course navigates to new course page", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    await ownerPage
      .getByRole("dialog")
      .getByText(/create course/i)
      .click();

    await expect(ownerPage).toHaveURL(/\/ai\/new-course/);
  });

  test("selecting Logout navigates to logout URL", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    // Verify logout option is visible and clickable
    const logoutOption = ownerPage.getByRole("dialog").getByText(/^logout$/i);
    await expect(logoutOption).toBeVisible();

    // Click logout - the full logout flow is tested in main app
    // Here we just verify the command palette triggers navigation
    await Promise.all([
      ownerPage.waitForURL((url) => url.pathname !== `/${AI_ORG_SLUG}`),
      logoutOption.click(),
    ]);
  });
});

test.describe("Command Palette - Course Search", () => {
  test("does not search with fewer than 2 characters", async ({ ownerPage }) => {
    const course = await createTestCourse();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(course.title.charAt(0));

    // Should not show course results with single character
    await expect(dialog.getByText("Courses")).not.toBeVisible();
  });

  test("shows courses in results", async ({ ownerPage }) => {
    const course = await createTestCourse();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(course.title);

    await expect(dialog.getByText("Courses")).toBeVisible();
    await expect(dialog.getByText(course.title)).toBeVisible();
  });

  test("shows course description in results", async ({ ownerPage }) => {
    const course = await createTestCourse();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(course.title);

    await expect(dialog.getByText(course.title)).toBeVisible();
    await expect(dialog.getByText(course.description!)).toBeVisible();
  });

  test("clicking course navigates to course page", async ({ ownerPage }) => {
    const course = await createTestCourse();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(course.title);

    await dialog.getByText(course.title).click();

    await expect(ownerPage).toHaveURL(new RegExp(`/${AI_ORG_SLUG}/c/${course.slug}`));
  });

  test("shows No results found for non-matching query", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("xyznonexistent");

    await expect(dialog.getByText(/no results found/i)).toBeVisible();
  });

  test("handles rapid typing correctly", async ({ ownerPage }) => {
    const course = await createTestCourse();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");

    const partialTitle = course.title.slice(0, 5);
    await dialog.getByPlaceholder(/search/i).pressSequentially(partialTitle, { delay: 50 });

    await dialog.getByPlaceholder(/search/i).fill(course.title);

    await expect(dialog.getByText(course.title)).toBeVisible();
  });
});

test.describe("Command Palette - Chapter Search", () => {
  test("shows chapters in search results", async ({ ownerPage }) => {
    const { chapter } = await createTestChapter();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(chapter.title);

    await expect(dialog.getByText("Chapters")).toBeVisible();
    await expect(dialog.getByText(chapter.title)).toBeVisible();
  });

  test("shows chapter position badge", async ({ ownerPage }) => {
    const { chapter } = await createTestChapter();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(chapter.title);

    const chapterItem = dialog.getByRole("option").filter({
      hasText: chapter.title,
    });
    await expect(chapterItem).toBeVisible();
  });

  test("clicking chapter navigates to chapter page", async ({ ownerPage }) => {
    const { chapter, course } = await createTestChapter();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(chapter.title);

    await dialog.getByText(chapter.title).click();

    await expect(ownerPage).toHaveURL(
      new RegExp(`/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`),
    );
  });
});

test.describe("Command Palette - Lesson Search", () => {
  test("shows lessons in search results", async ({ ownerPage }) => {
    const { lesson } = await createTestLesson();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(lesson.title);

    await expect(dialog.getByText("Lessons")).toBeVisible();
    await expect(dialog.getByText(lesson.title)).toBeVisible();
  });

  test("clicking lesson navigates to lesson page", async ({ ownerPage }) => {
    const { chapter, course, lesson } = await createTestLesson();
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(lesson.title);

    await dialog.getByText(lesson.title).click();

    await expect(ownerPage).toHaveURL(
      new RegExp(`/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`),
    );
  });
});

test.describe("Command Palette - Keyboard Navigation", () => {
  let courseUrl: string;

  test.beforeAll(async () => {
    const org = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-kbd-${randomUUID().slice(0, 8)}`,
    });

    courseUrl = `/${AI_ORG_SLUG}/c/${course.slug}`;
  });

  test("focuses input on open", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const input = ownerPage.getByPlaceholder(/search/i);
    await expect(input).toBeFocused();
  });

  test("arrow key navigation selects items", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Wait for cmdk to initialize and auto-select first item
    const firstOption = dialog.getByRole("option", { selected: true });
    await expect(firstOption).toBeVisible();
    const firstName = await firstOption.textContent();

    if (!firstName) {
      throw new Error("Expected first option to have text content");
    }

    // Press ArrowDown and poll until selection changes to a different item
    await ownerPage.keyboard.press("ArrowDown");
    await expect(async () => {
      const currentSelected = dialog.getByRole("option", { selected: true });
      const currentName = await currentSelected.textContent();
      expect(currentName).not.toBe(firstName);
    }).toPass();

    // Get the second item's name for the ArrowUp test
    const secondOption = dialog.getByRole("option", { selected: true });
    const secondName = await secondOption.textContent();

    if (!secondName) {
      throw new Error("Expected second option to have text content");
    }

    // Press ArrowUp and poll until selection changes back to first item
    await ownerPage.keyboard.press("ArrowUp");
    await expect(async () => {
      const currentSelected = dialog.getByRole("option", { selected: true });
      const currentName = await currentSelected.textContent();
      expect(currentName).toBe(firstName);
    }).toPass();
  });

  test("Enter to select navigates correctly", async ({ ownerPage }) => {
    await ownerPage.goto(courseUrl);
    await ownerPage.getByRole("button", { name: /search/i }).click();
    await expect(ownerPage.getByRole("dialog")).toBeVisible();

    await ownerPage.getByPlaceholder(/search/i).fill("Home");
    await ownerPage.keyboard.press("ArrowDown");
    await ownerPage.keyboard.press("Enter");

    await expect(ownerPage).toHaveURL(/\/ai$/);
  });

  test("focus trap within dialog", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("button", { name: /search/i }).click();
    await expect(ownerPage.getByRole("dialog")).toBeVisible();

    await ownerPage.keyboard.press("Tab");
    await ownerPage.keyboard.press("Tab");
    await ownerPage.keyboard.press("Tab");

    await expect(ownerPage.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Command Palette - Mobile Viewport", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("command palette opens and functions on mobile", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/search/i)).toBeVisible();
  });
});

test.describe("Command Palette - Accessibility", () => {
  test("has dialog role", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("has accessible title", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    const hasLabel = await dialog.evaluate(
      (el) => el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
    );
    expect(hasLabel).toBe(true);
  });

  test("search button indicates keyboard shortcut", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);

    const searchButton = ownerPage.getByRole("button", { name: /search/i });
    await expect(searchButton).toHaveAttribute("aria-keyshortcuts", /k/i);
  });

  test("search input has font-size >= 16px on mobile to prevent iOS Safari zoom", async ({
    browser,
    ownerUser,
  }) => {
    const context = await browser.newContext({
      storageState: ownerUser.storageState,
      viewport: { height: 667, width: 375 },
    });

    const page = await context.newPage();
    await page.goto(`/${AI_ORG_SLUG}`);
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/i);

    const fontSize = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    expect(fontSize).toBeGreaterThanOrEqual(16);

    await context.close();
  });
});
