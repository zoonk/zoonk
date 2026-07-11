import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
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
    chapterFixture({
      courseId: enCourse.id,
      description: `English chapter locale result ${uniqueId}`,
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(enChapterTitle),
      organizationId: org.id,
      position: 0,
      slug: `e2e-locale-chapter-en-${uniqueId}`,
      title: enChapterTitle,
    }),
    chapterFixture({
      courseId: ptCourse.id,
      description: `Portuguese chapter locale result ${uniqueId}`,
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptChapterTitle),
      organizationId: org.id,
      position: 0,
      slug: `e2e-locale-chapter-pt-${uniqueId}`,
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
    await page.goto("/");
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

  test("shows Pages group with Home and start goals", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("group", { name: "Pages" })).toBeVisible();
    await expect(dialog.getByText(/home page/iu)).toBeVisible();
    await expect(dialog.getByRole("option", { name: /^courses$/iu })).not.toBeVisible();
    await expect(dialog.getByText(/start a new course/iu)).toBeVisible();
    await expect(dialog.getByText(/speak a language/iu)).toBeVisible();
    await expect(dialog.getByText(/learn something/iu)).toBeVisible();
    await expect(dialog.getByText(/pass an exam/iu)).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
  });

  test("selecting Start a new course shows the goal picker", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/start a new course/iu)
      .click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
  });

  test("selecting a start goal opens that path", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/pass an exam/iu)
      .click();

    await expect(page).toHaveURL(/\/start\/exam$/u);
    await expect(page.getByRole("heading", { name: /pass an exam/iu })).toBeVisible();
  });
});

test.describe("Command Palette - Authenticated", () => {
  test("shows My account group with authenticated options", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^my courses$/iu)).toBeVisible();
    await expect(dialog.getByText(/manage subscription/iu)).toBeVisible();
    await expect(dialog.getByText(/update language/iu)).toBeVisible();
    await expect(dialog.getByText(/update profile/iu)).toBeVisible();
    await expect(dialog.getByText(/^logout$/iu)).toBeVisible();
  });

  test("does NOT show Login option when authenticated", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^login$/iu)).not.toBeVisible();
  });

  test("selecting My courses shows user's enrolled courses", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/^my courses$/iu)
      .click();

    // Verify user sees my courses page
    await expect(authenticatedPage.getByRole("heading", { name: /my courses/iu })).toBeVisible();
  });

  test("selecting Subscription shows subscription content", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/manage subscription/iu)
      .click();

    // Verify user sees subscription page
    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /subscription/iu }),
    ).toBeVisible();
  });

  // Logout test uses dedicated logoutPage fixture to avoid session interference
  test("selecting Logout logs user out and shows the home start goals", async ({ logoutPage }) => {
    await logoutPage.goto("/");

    // Verify authenticated state by checking command palette shows Logout option
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^logout$/iu)).toBeVisible();

    // Click logout - this triggers a hard navigation
    await logoutPage
      .getByRole("dialog")
      .getByText(/^logout$/iu)
      .click();

    await logoutPage.waitForURL(/\/$/u);
    await logoutPage.waitForLoadState("networkidle");

    // Verify user is logged out - command palette should show Login option
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^login$/iu)).toBeVisible();
  });
});

test.describe("Command Palette - Course Search", () => {
  test("does not search with fewer than 2 characters", async ({ page }) => {
    const course = await createTestCourse();
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    // Type single character from unique course title
    await dialog.getByPlaceholder(/search/iu).fill(course.title.charAt(0));

    // Should not show course search results with single character
    await expect(dialog.getByText(course.title)).not.toBeVisible();
  });

  test("shows course in results and navigates to detail page", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);
    const courseName = `E2E Search Nav ${uniqueId}`;
    const courseDescription = `Searchable course for navigation ${uniqueId}`;

    const course = await courseFixture({
      description: courseDescription,
      isPublished: true,
      normalizedTitle: normalizeString(courseName),
      organizationId: org.id,
      slug: `e2e-search-nav-${uniqueId}`,
      title: courseName,
    });

    // Course needs a chapter so the detail page renders instead of redirecting
    await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
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
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `E2E Palette Mixed ${uniqueId}`;
    const courseName = `${searchTerm} Course`;
    const chapterName = `${searchTerm} Chapter`;
    const chapterDescription = `Chapter result description ${uniqueId}`;

    const course = await courseFixture({
      description: `Course result description ${uniqueId}`,
      isPublished: true,
      normalizedTitle: normalizeString(courseName),
      organizationId: org.id,
      slug: `e2e-palette-course-${uniqueId}`,
      title: courseName,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      description: chapterDescription,
      isPublished: true,
      normalizedTitle: normalizeString(chapterName),
      organizationId: org.id,
      position: 0,
      slug: `e2e-palette-chapter-${uniqueId}`,
      title: chapterName,
    });

    await page.goto("/");
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

    await expect(page).toHaveURL(`/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}`);
    await expect(page.getByRole("button", { name: new RegExp(chapterName, "u") })).toBeVisible();
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

    await chapterFixture({
      courseId: course.id,
      description: longDescription,
      isPublished: true,
      normalizedTitle: normalizeString(chapterName),
      organizationId: org.id,
      position: 0,
      slug: `e2e-long-result-chapter-${uniqueId}`,
      title: chapterName,
    });

    await page.goto("/");
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

  test("suggests creating a course for non-matching query", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const prompt = `E2E Empty Search ${uniqueId}`;

    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(prompt);

    await expect(dialog.getByText(/no results found/iu)).toBeVisible();

    const createCourseLink = dialog.getByRole("link", { name: `Create a course about ${prompt}` });

    await expect(createCourseLink).toBeVisible();
    await createCourseLink.click();

    await expect(page).toHaveURL(new RegExp(`/start/learn/${encodeURIComponent(prompt)}$`, "u"));
  });

  test("handles rapid typing correctly", async ({ page }) => {
    const course = await createTestCourse();
    await page.goto("/");
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

    await page.goto("/");
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
    await page.goto("/");
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
    await page.goto("/");
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/iu);
    await expect(input).toBeFocused();
  });

  test("arrow key navigation selects items", async ({ page }) => {
    await page.goto("/");
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
    const learnOption = dialog.getByRole("option", { name: /start a new course/iu });
    await expect(learnOption).toBeVisible();

    // Press ArrowDown - "Start a new course" should now be selected
    await page.keyboard.press("ArrowDown");
    await expectActiveOption(page, /start a new course/iu);

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
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
  });

  test("focus trap within dialog", async ({ page }) => {
    await page.goto("/");
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
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Can interact with the palette
    await expect(dialog.getByPlaceholder(/search/iu)).toBeVisible();
  });
});

test.describe("Command Palette - Accessibility", () => {
  test("has dialog role", async ({ page }) => {
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("has accessible title", async ({ page }) => {
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");

    const hasLabel = await dialog.evaluate(
      (el) => el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
    );

    expect(hasLabel).toBe(true);
  });

  test("search button indicates keyboard shortcut", async ({ page }) => {
    await page.goto("/");

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

    await page.goto("/");
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/iu);

    // oxlint-disable-next-line unicorn/prefer-number-coercion -- Computed font size includes a CSS unit such as "16px", so Number would return NaN.
    const fontSize = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    expect(fontSize).toBeGreaterThanOrEqual(16);

    await context.close();
  });
});
