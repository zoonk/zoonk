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
import { openLearnerPalette, openPaletteWithKeyboard } from "./command-palette";
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
 * Opens the palette with Cmd/Ctrl+K, its shortcut everywhere; the account menu's "Search" opens
 * the same palette (`navbar.test.ts`).
 */
async function openCommandPalette(page: Page) {
  await openPaletteWithKeyboard(page, SEARCH_CONTROL_NAME);
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
 * With the debounce window held open, so a fast response cannot hide stale results, a short query
 * clears the stored results at once, and they come back only for the next real search.
 */
async function expectStoredResultsCleared({
  courseOption,
  courseTitle,
  input,
  page,
  shortQuery,
}: {
  courseOption: Locator;
  courseTitle: string;
  input: Locator;
  page: Page;
  shortQuery: string;
}) {
  await page.clock.pauseAt(new Date(Date.now() + 1000));

  await input.fill(shortQuery);
  await expect(courseOption).not.toBeVisible();
  await input.fill(courseTitle.slice(0, -1));
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

    // Search has no button in the bar: the account menu and the shortcut open it.
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: /search/iu })).toHaveCount(0);
  });

  test("opens from Ctrl+K / Cmd+K, and closes on Escape, the shortcut and outside clicks", async ({
    page,
  }) => {
    const dialog = page.getByRole("dialog");
    const modifier = getModifierKey();

    await openCommandPalette(page);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press(`${modifier}+k`);
    await expect(dialog).toBeVisible();
    await page.keyboard.press(`${modifier}+k`);
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press(`${modifier}+k`);
    await expect(dialog).toBeVisible();

    // Click outside the dialog (on the overlay/backdrop)
    await page
      .locator("[data-slot='dialog-overlay']")
      .click({ force: true, position: { x: 10, y: 10 } });

    await expect(dialog).not.toBeVisible();
  });

  test("shows the same Go to, Pricing, Log in and Explore courses vocabulary to visitors", async ({
    page,
  }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    const pages = dialog.getByRole("group", { name: "Go to" });

    await expect(pages).toBeVisible();

    await expect(pages.getByRole("option")).toHaveText([
      /home page/iu,
      /^explore courses/iu,
      /^start a goal$/iu,
      /^pricing$/iu,
      /^log in$/iu,
    ]);

    await expect(pages.getByRole("option", { name: /^log in$/iu })).toHaveAttribute(
      "href",
      "/login?next=%2Fcourses",
    );

    await expect(dialog.getByText("My account")).toHaveCount(0);

    // Should NOT show authenticated-only options
    await expect(dialog.getByText(/^subscription$/iu)).not.toBeVisible();
    await expect(dialog.getByText(/^profile$/iu)).not.toBeVisible();

    await expect(dialog.getByRole("option", { exact: true, name: "Help" })).toBeVisible();

    await dialog.getByRole("combobox", { name: /search/iu }).fill("settings");

    await expect(pages.getByRole("option")).toHaveText([
      /^settings/iu,
      /^preferences$/iu,
      /^language$/iu,
    ]);
  });

  test("selecting Explore courses or Start a goal opens that page", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByRole("option", { name: /^explore courses/iu })
      .click();

    await expect(page).toHaveURL(/\/courses$/u);
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/^start a goal$/iu)
      .click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  });
});

test.describe("Command Palette - Authenticated", () => {
  test("Settings pages are found in Go to, without Log in, and open the language and subscription", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/courses");
    // Their account pages land above the row a query highlights first: they wait for the learner.
    await openLearnerPalette(page, SEARCH_CONTROL_NAME);

    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("combobox", { name: SEARCH_CONTROL_NAME });

    // A learner's palette opens on their actions and places; the account is a query away.
    await expect(dialog.getByRole("group", { name: "Go to" })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "My account" })).toHaveCount(0);

    for (const option of ["Subscription", "Profile"]) {
      // oxlint-disable-next-line no-await-in-loop -- One query after the other, in one field.
      await input.fill(option);

      // oxlint-disable-next-line no-await-in-loop -- Checked before the next query.
      await expect(
        dialog.getByRole("group", { name: "Go to" }).getByRole("option", { name: option }),
      ).toBeVisible();
    }

    await input.fill("log");
    await expect(dialog.getByRole("option", { exact: true, name: "Log in" })).toHaveCount(0);

    await input.fill("language");
    await dialog.getByRole("option", { name: /^Language/u }).click();

    // The language lives in Preferences.
    await expect(page.getByRole("combobox", { name: "App language" })).toBeVisible();

    await page.goto("/courses");
    await openLearnerPalette(page, SEARCH_CONTROL_NAME);
    await input.fill("subscription");
    await dialog.getByRole("option", { name: /^Subscription/u }).click();

    // Verify user sees subscription page
    await expect(
      page.getByRole("heading", { level: 1, name: "Subscribe to Zoonk Plus" }),
    ).toBeVisible();
  });

  // Logout test uses dedicated logoutPage fixture to avoid session interference
  test("selecting Logout logs user out and shows the visitor home page", async ({ logoutPage }) => {
    await logoutPage.goto("/courses");

    // Verify authenticated state by checking command palette finds the Logout option
    await openLearnerPalette(logoutPage, SEARCH_CONTROL_NAME);

    await logoutPage
      .getByRole("dialog")
      .getByRole("combobox", { name: SEARCH_CONTROL_NAME })
      .fill("logout");

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
      logoutPage.getByRole("heading", { level: 1, name: /Know what to study/iu }),
    ).toBeVisible();

    // Verify user is logged out - command palette should show Login option
    await logoutPage.goto("/courses");
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^log in$/iu)).toBeVisible();
  });
});

test.describe("Command Palette - Course Search", () => {
  test("clears stored search results when the query is emptied or becomes one character", async ({
    page,
  }) => {
    const course = await createTestCourse();

    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("combobox", { name: SEARCH_CONTROL_NAME });
    const courseOption = dialog.getByRole("option", { name: new RegExp(`^${course.title}`, "u") });

    await input.fill(course.title);
    await expect(courseOption).toBeVisible();

    await page.clock.install();

    for (const shortQuery of ["", "e"]) {
      // oxlint-disable-next-line no-await-in-loop -- Each short query starts from stored results.
      await expectStoredResultsCleared({
        courseOption,
        courseTitle: course.title,
        input,
        page,
        shortQuery,
      });
    }
  });

  test("shows compact course and chapter rows in the catalog and opens either destination", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `E2E Palette Mixed ${uniqueId}`;
    const courseName = `${searchTerm} Course`;
    const chapterName = `${searchTerm} Chapter`;
    const courseDescription = `Course result description ${uniqueId}`;
    const chapterDescription = `Chapter result description ${uniqueId}`;

    const { course, organization } = await catalogCourseFixture({
      description: courseDescription,
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
    await expect(courseOption.getByText(courseDescription)).toHaveCount(0);
    await expect(chapterOption).toBeVisible();
    await expect(chapterOption.getByText(chapterDescription)).toHaveCount(0);
    await expect(chapterOption.getByText(courseName)).toBeVisible();
    await expect(dialog.getByRole("group", { name: "In the catalog" })).toBeVisible();

    const optionsText = await dialog.getByRole("option").allTextContents();
    const courseIndex = optionsText.findIndex((text) => text.includes(courseName));
    const chapterIndex = optionsText.findIndex((text) => text.includes(chapterName));

    expect(courseIndex).toBeGreaterThanOrEqual(0);
    expect(chapterIndex).toBeGreaterThan(courseIndex);

    await courseOption.click();

    await expect(page).toHaveURL(`/b/${organization.slug}/c/${course.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: courseName })).toBeVisible();

    // Public course pages have no search, so the chapter is searched from the catalog again.
    await page.goBack();
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
    await openCommandPalette(page);
    await dialog.getByPlaceholder(/search/iu).fill(searchTerm);
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

  test("ends every query with starting a goal from it, never a dead end", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const prompt = `E2E Empty Search ${uniqueId}`;

    await page.goto("/courses");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/iu).fill(prompt);

    const startGoal = dialog
      .getByRole("group", { name: "New goal" })
      .getByRole("option", { name: `Start a goal: “${prompt}”` });

    await expect(startGoal).toBeVisible();
    await expect(dialog.getByText(/no results found/iu)).toHaveCount(0);
    await startGoal.click();

    await expect(page).toHaveURL(`/start?goal=${encodeURIComponent(prompt)}`);
    await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue(prompt);
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
  test("arrow keys select items and Enter opens the highlighted home page", async ({ page }) => {
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
    const coursesOption = dialog.getByRole("option", { name: /^explore courses/iu });
    await expect(coursesOption).toBeVisible();

    // Press ArrowDown - "Explore courses" should now be selected
    await page.keyboard.press("ArrowDown");
    await expectActiveOption(page, /^explore courses/iu);

    // Press ArrowUp - "Home page" should be selected again
    await page.keyboard.press("ArrowUp");
    await expectActiveOption(page, /home page/iu);

    // Type to filter to Home option, the first one, then press Enter to select it
    await page.getByPlaceholder(/search/iu).fill("Home");
    await expectActiveOption(page, /home page/iu);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /Know what to study/iu }),
    ).toBeVisible();
  });
});

test.describe("Command Palette - Mobile Viewport", () => {
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
