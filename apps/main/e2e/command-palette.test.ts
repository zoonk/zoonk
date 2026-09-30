import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";

const SEARCH_CONTROL_NAME = /search|buscar|pesquisar/iu;

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

/**
 * The command palette searches courses and chapters together, so locale
 * filtering needs a mixed catalog setup where both result kinds share the same
 * query in different languages.
 */
async function createLocalizedSearchCatalog() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const enCourseTitle = `E2E Locale EN ${uniqueId}`;
  const ptCourseTitle = `E2E Locale PT ${uniqueId}`;
  const enChapterTitle = `E2E Locale Chapter EN ${uniqueId}`;
  const ptChapterTitle = `E2E Locale Chapter PT ${uniqueId}`;

  const [enCourse, ptCourse] = await Promise.all([
    courseFixture({
      description: `English locale result ${uniqueId}`,
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(enCourseTitle),
      organizationId: org.id,
      slug: `e2e-locale-en-${uniqueId}`,
      title: enCourseTitle,
    }),
    courseFixture({
      description: `Portuguese locale result ${uniqueId}`,
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptCourseTitle),
      organizationId: org.id,
      slug: `e2e-locale-pt-${uniqueId}`,
      title: ptCourseTitle,
    }),
  ]);

  await Promise.all([
    libraryChapterFixture({
      description: `English chapter locale result ${uniqueId}`,
      homeCourseId: enCourse.id,
      language: "en",
      normalizedTitle: normalizeString(enChapterTitle),
      title: enChapterTitle,
    }),
    libraryChapterFixture({
      description: `Portuguese chapter locale result ${uniqueId}`,
      homeCourseId: ptCourse.id,
      language: "pt",
      normalizedTitle: normalizeString(ptChapterTitle),
      title: ptChapterTitle,
    }),
  ]);

  return { enChapterTitle, enCourseTitle, ptChapterTitle, ptCourseTitle, uniqueId };
}

/**
 * Opens the command palette through the real navbar trigger so tests interact
 * with the same hydrated chrome learners use.
 */
async function openCommandPalette(page: Page) {
  const searchButton = page
    .getByRole("navigation")
    .getByRole("button", { name: SEARCH_CONTROL_NAME });

  await expect(async () => {
    await searchButton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/**
 * Base UI keeps listbox focus on the input and points assistive technology to
 * the highlighted option with aria-activedescendant, so keyboard navigation
 * assertions should follow that semantic relationship.
 */
async function expectActiveOption(page: Page, optionName: RegExp) {
  const dialog = page.getByRole("dialog");
  const input = dialog.getByPlaceholder(/search/iu);
  const option = dialog.getByRole("option", { name: optionName });
  const optionId = await option.getAttribute("id");

  expect(optionId).toBeTruthy();
  await expect(input).toHaveAttribute("aria-activedescendant", optionId!);
}

async function expectSearchResultsReset({ page, shortQuery }: { page: Page; shortQuery: string }) {
  const course = await createTestCourse();

  await page.goto("/courses");
  await openCommandPalette(page);

  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("combobox", { name: SEARCH_CONTROL_NAME });
  const courseOption = dialog.getByRole("option", { name: new RegExp(`^${course.title}`, "u") });

  await input.fill(course.title);
  await expect(courseOption).toBeVisible();

  /** Hold the debounce window open so a fast response cannot hide stale results. */
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));

  await input.fill(shortQuery);
  await expect(courseOption).not.toBeVisible();
  await input.fill(course.title.slice(0, -1));
  await expect(courseOption).not.toBeVisible();

  await page.clock.resume();
  await expect(courseOption).toBeVisible();
}

/**
 * Long catalog titles and descriptions should truncate inside the palette; if
 * they increase scrollWidth, touch users can accidentally pan sideways instead
 * of only scrolling vertically through the result list.
 */
async function expectNoHorizontalScrollableOverflow(container: Locator) {
  const overflowingElements = await container.evaluate((element: HTMLElement) =>
    [element, ...element.querySelectorAll<HTMLElement>("*")]
      .filter((node) => {
        const { overflowX } = getComputedStyle(node);

        return (
          (overflowX === "auto" || overflowX === "scroll") &&
          node.scrollWidth > node.clientWidth + 1
        );
      })
      .map((node) => ({
        clientWidth: node.clientWidth,
        overflowX: getComputedStyle(node).overflowX,
        scrollWidth: node.scrollWidth,
        slot: node.dataset.slot,
      })),
  );

  expect(overflowingElements).toEqual([]);
}

// Helper to get the correct modifier key for the platform
function getModifierKey(): "Meta" | "Control" {
  // Playwright runs in Node.js, so process.platform is available
  return process.platform === "darwin" ? "Meta" : "Control";
}

test.describe("Command Palette - Unauthenticated", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("navigation").getByRole("button", { name: /search/iu }),
    ).toBeVisible();
  });

  test("toggles closed with Ctrl+K / Cmd+K when already open", async ({ page }) => {
    const modifier = getModifierKey();
    // Focus the page body to ensure keyboard events are received
    await page.locator("body").click();

    // Open
    await page.keyboard.press(`${modifier}+k`);
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close
    await page.keyboard.press(`${modifier}+k`);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("opens when clicking search button", async ({ page }) => {
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("closes on Escape", async ({ page }) => {
    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("closes when clicking outside", async ({ page }) => {
    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click outside the dialog (on the overlay/backdrop)
    await page
      .locator("[data-slot='dialog-overlay']")
      .click({ force: true, position: { x: 10, y: 10 } });

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("shows Pages group with Home, Courses, and Start a new course", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    const pages = dialog.getByRole("group", { name: "Pages" });

    await expect(pages).toBeVisible();

    await expect(pages.getByRole("option")).toHaveText([
      /home page/iu,
      /^courses$/iu,
      /start a new course/iu,
    ]);
  });

  test("shows My account group with Login and Language only", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("My account")).toBeVisible();
    await expect(dialog.getByText(/^login$/iu)).toBeVisible();
    await expect(dialog.getByText(/^language$/iu)).toBeVisible();

    // Should NOT show authenticated-only options
    await expect(dialog.getByText(/^my courses$/iu)).not.toBeVisible();
    await expect(dialog.getByText(/manage subscription/iu)).not.toBeVisible();
  });

  test("shows Help group with Feedback & Support", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Help")).toBeVisible();
    await expect(dialog.getByText(/feedback & support/iu)).toBeVisible();
  });

  test("selecting Home shows start goals on the home page", async ({ page }) => {
    await page.goto("/courses"); // Start from different page
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/home page/iu)
      .click();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });

  test("selecting Courses shows courses content", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByRole("option", { name: /^courses$/iu })
      .click();

    await expect(page).toHaveURL(/\/courses$/u);
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
  });

  test("selecting Start a new course shows the goal picker", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/start a new course/iu)
      .click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  });
});

test.describe("Command Palette - Authenticated", () => {
  test("shows My account group with authenticated options", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await openCommandPalette(authenticatedPage);

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^my courses$/iu)).toBeVisible();
    await expect(dialog.getByText(/manage subscription/iu)).toBeVisible();
    await expect(dialog.getByText(/update language/iu)).toBeVisible();
    await expect(dialog.getByText(/update profile/iu)).toBeVisible();
    await expect(dialog.getByText(/^logout$/iu)).toBeVisible();
  });

  test("does NOT show Login option when authenticated", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await openCommandPalette(authenticatedPage);

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^login$/iu)).not.toBeVisible();
  });

  test("selecting My courses shows user's enrolled courses", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/^my courses$/iu)
      .click();

    // Verify user sees my courses page
    await expect(authenticatedPage.getByRole("heading", { name: /my courses/iu })).toBeVisible();
  });

  test("selecting Subscription shows subscription content", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/manage subscription/iu)
      .click();

    // Verify user sees subscription page
    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /learn anything/iu }),
    ).toBeVisible();
  });

  // Logout test uses dedicated logoutPage fixture to avoid session interference
  test("selecting Logout logs user out and shows the visitor home page", async ({ logoutPage }) => {
    await logoutPage.goto("/courses");

    // Verify authenticated state by checking command palette shows Logout option
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^logout$/iu)).toBeVisible();

    // Logout reloads the app at the home page, so wait for the new main document
    // rather than a URL change that could resolve before sign-out starts.
    await Promise.all([
      logoutPage.waitForEvent("framenavigated", {
        predicate: (frame) => frame === logoutPage.mainFrame(),
      }),
      logoutPage
        .getByRole("dialog")
        .getByText(/^logout$/iu)
        .click(),
    ]);

    await expect(
      logoutPage.getByRole("heading", { level: 1, name: /get ready for/iu }),
    ).toBeVisible();

    // Verify user is logged out - command palette should show Login option
    await logoutPage.goto("/courses");
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^login$/iu)).toBeVisible();
  });
});

test.describe("Command Palette - Course Search", () => {
  test("clears stored search results when the query is emptied", async ({ page }) => {
    await expectSearchResultsReset({ page, shortQuery: "" });
  });

  test("clears stored search results when the query becomes one character", async ({ page }) => {
    await expectSearchResultsReset({ page, shortQuery: "e" });
  });

  test("does not search with fewer than 2 characters", async ({ page }) => {
    const course = await createTestCourse();
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    // Type single character from unique course title
    await dialog.getByPlaceholder(/search/iu).fill(course.title.charAt(0));

    // Should not show course search results with single character
    await expect(dialog.getByText(course.title)).not.toBeVisible();
  });

  test("shows course in results and navigates to detail page", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseName = `E2E Search Nav ${uniqueId}`;
    const courseDescription = `Searchable course for navigation ${uniqueId}`;

    await catalogCourseFixture({
      description: courseDescription,
      normalizedTitle: normalizeString(courseName),
      slug: `e2e-search-nav-${uniqueId}`,
      title: courseName,
    });

    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(courseName);

    // Wait for the course option to appear in results
    const courseOption = dialog.getByRole("option").filter({ hasText: courseName });
    await expect(courseOption).toBeVisible();

    // Course description should be visible
    await expect(courseOption.getByText(courseDescription, { exact: false })).toBeVisible();

    // Click the course option to navigate
    await courseOption.click();

    // Verify user sees course detail page
    await expect(page.getByRole("heading", { level: 1, name: courseName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows chapter results below courses and navigates to chapter page", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `E2E Palette Mixed ${uniqueId}`;
    const courseName = `${searchTerm} Course`;
    const chapterName = `${searchTerm} Chapter`;
    const chapterDescription = `Chapter result description ${uniqueId}`;

    const { course, organization } = await catalogCourseFixture({
      description: `Course result description ${uniqueId}`,
      lessonCounts: [],
      normalizedTitle: normalizeString(courseName),
      slug: `e2e-palette-course-${uniqueId}`,
      title: courseName,
    });

    const chapter = await libraryChapterFixture({
      description: chapterDescription,
      homeCourseId: course.id,
      normalizedTitle: normalizeString(chapterName),
      slug: `e2e-palette-chapter-${uniqueId}`,
      title: chapterName,
    });

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(searchTerm);

    const courseOption = dialog.getByRole("option", { name: new RegExp(`^${courseName}`, "u") });
    const chapterOption = dialog.getByRole("option", { name: new RegExp(`^${chapterName}`, "u") });

    await expect(courseOption).toBeVisible();
    await expect(chapterOption).toBeVisible();
    await expect(chapterOption.getByText(chapterDescription)).toBeVisible();

    const optionsText = await dialog.getByRole("option").allTextContents();
    const courseIndex = optionsText.findIndex((text) => text.includes(courseName));
    const chapterIndex = optionsText.findIndex((text) => text.includes(chapterName));

    expect(courseIndex).toBeGreaterThanOrEqual(0);
    expect(chapterIndex).toBeGreaterThan(courseIndex);

    await chapterOption.click();

    await expect(page).toHaveURL(`/b/${organization.slug}/c/${course.slug}/ch/${chapter.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: chapterName })).toBeVisible();
  });

  test("truncates long result content without horizontal overflow", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `E2E Long Result ${uniqueId}`;
    const courseName = `${searchTerm} Course`;
    const chapterName = `${searchTerm} Chapter`;

    const longDescription =
      "This result has a deliberately long description that should stay inside the command palette and truncate instead of making the dialog pan sideways on touch devices.";

    const course = await courseFixture({
      description: longDescription,
      isPublished: true,
      normalizedTitle: normalizeString(courseName),
      organizationId: org.id,
      slug: `e2e-long-result-course-${uniqueId}`,
      title: courseName,
    });

    await libraryChapterFixture({
      description: longDescription,
      homeCourseId: course.id,
      normalizedTitle: normalizeString(chapterName),
      title: chapterName,
    });

    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(searchTerm);

    await expect(
      dialog.getByRole("option", { name: new RegExp(`^${courseName}`, "u") }),
    ).toBeVisible();

    await expect(
      dialog.getByRole("option", { name: new RegExp(`^${chapterName}`, "u") }),
    ).toBeVisible();

    await expectNoHorizontalScrollableOverflow(dialog);
  });

  test("starts onboarding with a non-matching query as the goal", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const prompt = `E2E Empty Search ${uniqueId}`;

    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(prompt);

    await expect(dialog.getByText(/no results found/iu)).toBeVisible();

    const createCourseLink = dialog.getByRole("link", { name: `Create a course about ${prompt}` });

    await expect(createCourseLink).toBeVisible();
    await createCourseLink.click();

    await expect(page).toHaveURL(`/start?goal=${encodeURIComponent(prompt)}`);
    await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue(prompt);
  });

  test("handles rapid typing correctly", async ({ page }) => {
    const course = await createTestCourse();
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");

    // Type rapidly with corrections using unique title
    const partialTitle = course.title.slice(0, 5);
    await dialog.getByPlaceholder(/search/iu).pressSequentially(partialTitle, { delay: 50 });

    await dialog.getByPlaceholder(/search/iu).fill(course.title);

    // Should show correct results after debounce
    await expect(dialog.getByText(course.title)).toBeVisible();
  });

  test("shows exact match first when searching", async ({ page }) => {
    const org = await getAiOrganization();

    // Create test courses with a unique prefix to avoid conflicts
    const uniqueId = randomUUID().slice(0, 8);
    const exactMatchTitle = `Zlaw ${uniqueId}`;

    const partialMatchTitles = [
      `Criminal Zlaw ${uniqueId}`,
      `Tax Zlaw ${uniqueId}`,
      `Civil Zlaw ${uniqueId}`,
    ];

    // Create exact match course
    await courseFixture({
      description: `Exact match course ${uniqueId}`,
      isPublished: true,
      normalizedTitle: normalizeString(exactMatchTitle),
      organizationId: org.id,
      slug: `zlaw-${uniqueId}`,
      title: exactMatchTitle,
    });

    // Create partial match courses
    await Promise.all(
      partialMatchTitles.map((title) =>
        courseFixture({
          description: `Partial match course ${uniqueId}`,
          isPublished: true,
          normalizedTitle: normalizeString(title),
          organizationId: org.id,
          slug: `${title.toLowerCase().replaceAll(/\s+/gu, "-")}-${uniqueId}`,
          title,
        }),
      ),
    );

    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(`zlaw ${uniqueId}`);

    // Wait for results to load
    const options = dialog.getByRole("option");
    await expect(options.first()).toBeVisible();

    // The first result should be the exact match, not a partial match
    const firstOption = options.first();
    const firstOptionText = await firstOption.textContent();

    expect(firstOptionText).toBeTruthy();
    expect(firstOptionText!.startsWith(exactMatchTitle)).toBe(true);
    // Should NOT start with any partial matches
    for (const partialTitle of partialMatchTitles) {
      expect(firstOptionText!.startsWith(partialTitle)).toBe(false);
    }
  });

  test("shows only results from the active app language", async ({ page }) => {
    const { enChapterTitle, enCourseTitle, ptChapterTitle, ptCourseTitle, uniqueId } =
      await createLocalizedSearchCatalog();

    await setLocale(page, "pt");
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: SEARCH_CONTROL_NAME }).fill(uniqueId);

    await expect(
      dialog.getByRole("option", { name: new RegExp(`^${ptCourseTitle}`, "u") }),
    ).toBeVisible();

    await expect(
      dialog.getByRole("option", { name: new RegExp(`^${ptChapterTitle}`, "u") }),
    ).toBeVisible();

    await expect(
      dialog.getByRole("option", { name: new RegExp(`^${enCourseTitle}`, "u") }),
    ).not.toBeVisible();

    await expect(
      dialog.getByRole("option", { name: new RegExp(`^${enChapterTitle}`, "u") }),
    ).not.toBeVisible();
  });
});

test.describe("Command Palette - Keyboard Navigation", () => {
  test("focuses input on open", async ({ page }) => {
    await page.goto("/courses");
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/iu);
    await expect(input).toBeFocused();
  });

  test("arrow key navigation selects items", async ({ page }) => {
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Ensure the search input is focused so Base UI receives keyboard events
    const input = dialog.getByPlaceholder(/search/iu);
    await expect(input).toBeFocused();

    // Wait for Base UI to initialize - first item "Home page" should be active
    const homeOption = dialog.getByRole("option", { name: /home page/iu });
    await expect(homeOption).toBeVisible();
    await expectActiveOption(page, /home page/iu);

    // Also wait for the second option to be present before navigating
    const coursesOption = dialog.getByRole("option", { name: /^courses$/iu });
    await expect(coursesOption).toBeVisible();

    // Press ArrowDown - "Courses" should now be selected
    await page.keyboard.press("ArrowDown");
    await expectActiveOption(page, /^courses$/iu);

    // Press ArrowUp - "Home page" should be selected again
    await page.keyboard.press("ArrowUp");
    await expectActiveOption(page, /home page/iu);
  });

  test("Enter to select shows start goals on the home page", async ({ page }) => {
    await page.goto("/courses"); // Start from courses page so Home navigation is verifiable
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    // Type to filter to Home option, then press Enter to select it
    await page.getByPlaceholder(/search/iu).fill("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });

  test("focus trap within dialog", async ({ page }) => {
    await page.goto("/courses");
    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    // Tab multiple times to cycle through focusable elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Dialog should still be visible (focus trapped)
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Command Palette - Mobile Viewport", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("command palette opens and functions on mobile", async ({ page }) => {
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Can interact with the palette
    await expect(dialog.getByPlaceholder(/search/iu)).toBeVisible();
  });
});

test.describe("Command Palette - Accessibility", () => {
  test("has dialog role", async ({ page }) => {
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("has accessible title", async ({ page }) => {
    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");

    const hasLabel = await dialog.evaluate(
      (el) => el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
    );

    expect(hasLabel).toBe(true);
  });

  test("search button indicates keyboard shortcut", async ({ page }) => {
    await page.goto("/courses");

    // Scoped to navigation to avoid strict mode violation
    const searchButton = page.getByRole("navigation").getByRole("button", { name: /search/iu });
    await expect(searchButton).toHaveAttribute("aria-keyshortcuts", /k/iu);
  });

  /**
   * IOS Safari automatically zooms when focusing inputs with font-size < 16px.
   * This test verifies the input meets the 16px threshold on mobile to prevent this behavior.
   */
  test("search input has font-size >= 16px on mobile to prevent iOS Safari zoom", async ({
    browser,
  }) => {
    // Create a mobile-sized context since iOS Safari zoom only affects mobile
    const context = await browser.newContext({ viewport: { height: 667, width: 375 } });

    const page = await context.newPage();

    await page.goto("/courses");
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/iu);

    // oxlint-disable-next-line unicorn/prefer-number-coercion -- Computed font size includes a CSS unit such as "16px", so Number would return NaN.
    const fontSize = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    expect(fontSize).toBeGreaterThanOrEqual(16);

    await context.close();
  });
});
