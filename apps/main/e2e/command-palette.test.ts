import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";

async function createTestCourse() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

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

// Helper to open command palette via click (reliable for tests that don't test keyboard shortcuts)
// Scoped to navigation to avoid strict mode violation when multiple search buttons exist during streaming
async function openCommandPalette(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /search/i })
    .click();
}

// Helper to get the correct modifier key for the platform
function getModifierKey(): "Meta" | "Control" {
  // Playwright runs in Node.js, so process.platform is available
  return process.platform === "darwin" ? "Meta" : "Control";
}

test.describe("Command Palette - Unauthenticated", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the page to be fully interactive before testing keyboard shortcuts
    // Scoped to navigation to avoid strict mode violation
    await expect(
      page.getByRole("navigation").getByRole("button", { name: /search/i }),
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

  test("shows Pages group with Home, Courses, Learn", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Pages")).toBeVisible();
    await expect(dialog.getByText(/home page/i)).toBeVisible();
    await expect(dialog.getByText(/^courses$/i)).toBeVisible();
    await expect(dialog.getByText(/learn something/i)).toBeVisible();
  });

  test("shows My account group with Login and Language only", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("My account")).toBeVisible();
    await expect(dialog.getByText(/^login$/i)).toBeVisible();
    await expect(dialog.getByText(/^language$/i)).toBeVisible();

    // Should NOT show authenticated-only options
    await expect(dialog.getByText(/^my courses$/i)).not.toBeVisible();
    await expect(dialog.getByText(/manage subscription/i)).not.toBeVisible();
  });

  test("shows Contact us group with Help and support", async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Contact us")).toBeVisible();
    await expect(dialog.getByText(/help and support/i)).toBeVisible();
  });

  test("selecting Home shows home content", async ({ page }) => {
    await page.goto("/courses"); // Start from different page
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/home page/i)
      .click();

    // Verify user sees home page content
    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();
  });

  test("selecting Courses shows courses content", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/^courses$/i)
      .click();

    // Verify user sees courses page content
    await expect(page.getByRole("heading", { name: /explore courses/i })).toBeVisible();
  });

  test("selecting Learn shows learn form", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/learn something/i)
      .click();

    // Verify user sees learn page content
    await expect(page.getByRole("heading", { name: /what do you want to learn/i })).toBeVisible();
  });
});

test.describe("Command Palette - Authenticated", () => {
  test("shows My account group with authenticated options", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^my courses$/i)).toBeVisible();
    await expect(dialog.getByText(/manage subscription/i)).toBeVisible();
    await expect(dialog.getByText(/update language/i)).toBeVisible();
    await expect(dialog.getByText(/update display name/i)).toBeVisible();
    await expect(dialog.getByText(/^logout$/i)).toBeVisible();
  });

  test("does NOT show Login option when authenticated", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^login$/i)).not.toBeVisible();
  });

  test("selecting My courses shows user's enrolled courses", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/^my courses$/i)
      .click();

    // Verify user sees my courses page
    await expect(authenticatedPage.getByRole("heading", { name: /my courses/i })).toBeVisible();
  });

  test("selecting Subscription shows subscription content", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/manage subscription/i)
      .click();

    // Verify user sees subscription page
    await expect(
      authenticatedPage.getByRole("heading", {
        level: 1,
        name: /subscription/i,
      }),
    ).toBeVisible();
  });

  // Logout test uses dedicated logoutPage fixture to avoid session interference
  test("selecting Logout logs user out and redirects to home", async ({ logoutPage }) => {
    await logoutPage.goto("/");

    // Verify authenticated state by checking command palette shows Logout option
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^logout$/i)).toBeVisible();

    // Click logout - this triggers a hard navigation
    await Promise.all([
      logoutPage.waitForURL(/^[^?]*\/$/),
      logoutPage.waitForResponse(
        (response) => response.url().includes("/api/auth/get-session") && response.status() === 200,
      ),
      logoutPage
        .getByRole("dialog")
        .getByText(/^logout$/i)
        .click(),
    ]);

    // Verify user is logged out - command palette should show Login option
    await openCommandPalette(logoutPage);
    await expect(logoutPage.getByRole("dialog").getByText(/^login$/i)).toBeVisible();
  });
});

test.describe("Command Palette - Course Search", () => {
  test("does not search with fewer than 2 characters", async ({ page }) => {
    const course = await createTestCourse();
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    // Type single character from unique course title
    await dialog.getByPlaceholder(/search/i).fill(course.title.charAt(0));

    // Should not show course search results with single character
    await expect(dialog.getByText(course.title)).not.toBeVisible();
  });

  test("shows course in results and navigates to detail page", async ({ page }) => {
    // Use a seeded course (Machine Learning) that is pre-rendered for navigation testing
    // New courses created via fixtures won't have their detail pages pre-rendered
    const courseName = "Machine Learning";
    const courseDescription = "Machine learning enables computers";

    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(courseName);

    // Wait for the course option to appear in results
    const courseOption = dialog.getByRole("option").filter({ hasText: courseName });
    await expect(courseOption).toBeVisible();

    // Course description should be visible
    await expect(courseOption.getByText(courseDescription, { exact: false })).toBeVisible();

    // Click the course option to navigate
    await courseOption.click();

    // Verify user sees course detail page
    await expect(page.getByRole("heading", { level: 1, name: courseName })).toBeVisible();
  });

  test("shows No results found for non-matching query", async ({ page }) => {
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("xyznonexistent");

    await expect(dialog.getByText(/no results found/i)).toBeVisible();
  });

  test("handles rapid typing correctly", async ({ page }) => {
    const course = await createTestCourse();
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");

    // Type rapidly with corrections using unique title
    const partialTitle = course.title.slice(0, 5);
    await dialog.getByPlaceholder(/search/i).pressSequentially(partialTitle, { delay: 50 });

    await dialog.getByPlaceholder(/search/i).fill(course.title);

    // Should show correct results after debounce
    await expect(dialog.getByText(course.title)).toBeVisible();
  });

  test("shows exact match first when searching", async ({ page }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

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
          slug: `${title.toLowerCase().replaceAll(/\s+/g, "-")}-${uniqueId}`,
          title,
        }),
      ),
    );

    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill(`zlaw ${uniqueId}`);

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
});

test.describe("Command Palette - Keyboard Navigation", () => {
  test("focuses input on open", async ({ page }) => {
    await page.goto("/");
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/i);
    await expect(input).toBeFocused();
  });

  test("arrow key navigation selects items", async ({ page }) => {
    await page.goto("/");
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Wait for cmdk to initialize - first item "Home page" should be selected
    const homeOption = dialog.getByRole("option", { name: /home page/i });
    await expect(homeOption).toHaveAttribute("aria-selected", "true");

    // Press ArrowDown - "Courses" should now be selected
    await page.keyboard.press("ArrowDown");

    const coursesOption = dialog.getByRole("option", { name: /^courses$/i });
    await expect(coursesOption).toHaveAttribute("aria-selected", "true");
    await expect(homeOption).toHaveAttribute("aria-selected", "false");

    // Press ArrowUp - "Home page" should be selected again
    await page.keyboard.press("ArrowUp");

    await expect(homeOption).toHaveAttribute("aria-selected", "true");
    await expect(coursesOption).toHaveAttribute("aria-selected", "false");
  });

  test("Enter to select navigates correctly", async ({ page }) => {
    await page.goto("/courses"); // Start from courses page so Home navigation is verifiable
    await openCommandPalette(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    // Type to filter to Home option, then press Enter to select it
    await page.getByPlaceholder(/search/i).fill("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Verify user sees home page content
    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();
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
    await expect(dialog.getByPlaceholder(/search/i)).toBeVisible();
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
    const searchButton = page.getByRole("navigation").getByRole("button", { name: /search/i });
    await expect(searchButton).toHaveAttribute("aria-keyshortcuts", /k/i);
  });

  /**
   * IOS Safari automatically zooms when focusing inputs with font-size < 16px.
   * This test verifies the input meets the 16px threshold on mobile to prevent this behavior.
   */
  test("search input has font-size >= 16px on mobile to prevent iOS Safari zoom", async ({
    browser,
  }) => {
    // Create a mobile-sized context since iOS Safari zoom only affects mobile
    const context = await browser.newContext({
      viewport: { height: 667, width: 375 },
    });

    const page = await context.newPage();

    await page.goto("/");
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/i);

    const fontSize = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    expect(fontSize).toBeGreaterThanOrEqual(16);

    await context.close();
  });
});
