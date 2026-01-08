import { expect, type Page, test } from "./fixtures";

// Helper to open command palette via click (reliable for tests that don't test keyboard shortcuts)
async function openCommandPalette(page: Page) {
  await page.getByRole("button", { name: /search/i }).click();
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
    await expect(page.getByRole("button", { name: /search/i })).toBeVisible();
  });

  test("toggles closed with Ctrl+K / Cmd+K when already open", async ({
    page,
  }) => {
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
    await page.getByRole("button", { name: /search/i }).click();
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

  test("shows My account group with Login and Language only", async ({
    page,
  }) => {
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
    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });

  test("selecting Courses shows courses content", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/^courses$/i)
      .click();

    // Verify user sees courses page content
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
  });

  test("selecting Learn shows learn form", async ({ page }) => {
    await openCommandPalette(page);

    await page
      .getByRole("dialog")
      .getByText(/learn something/i)
      .click();

    // Verify user sees learn page content
    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });
});

test.describe("Command Palette - Authenticated", () => {
  test("shows My account group with authenticated options", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /search/i }).click();

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^my courses$/i)).toBeVisible();
    await expect(dialog.getByText(/manage subscription/i)).toBeVisible();
    await expect(dialog.getByText(/manage settings/i)).toBeVisible();
    await expect(dialog.getByText(/update language/i)).toBeVisible();
    await expect(dialog.getByText(/update display name/i)).toBeVisible();
    await expect(dialog.getByText(/^logout$/i)).toBeVisible();
  });

  test("does NOT show Login option when authenticated", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /search/i }).click();

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog.getByText(/^login$/i)).not.toBeVisible();
  });

  test("selecting My courses shows user's enrolled courses", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /search/i }).click();

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/^my courses$/i)
      .click();

    // Verify user sees my courses page
    await expect(
      authenticatedPage.getByRole("heading", { name: /my courses/i }),
    ).toBeVisible();
  });

  test("selecting Subscription shows subscription content", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /search/i }).click();

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

  test("selecting Settings shows settings content", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /search/i }).click();

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/manage settings/i)
      .click();

    // Verify user sees settings page
    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });

  // Logout test uses dedicated logoutPage fixture to avoid session interference
  test("selecting Logout logs user out and redirects to home", async ({
    logoutPage,
  }) => {
    await logoutPage.goto("/");

    // Verify authenticated state by checking command palette shows Logout option
    await logoutPage.getByRole("button", { name: /search/i }).click();
    await expect(
      logoutPage.getByRole("dialog").getByText(/^logout$/i),
    ).toBeVisible();

    // Click logout - this triggers a hard navigation
    await Promise.all([
      logoutPage.waitForURL(/^[^?]*\/$/),
      logoutPage.waitForResponse(
        (response) =>
          response.url().includes("/api/auth/get-session") &&
          response.status() === 200,
      ),
      logoutPage
        .getByRole("dialog")
        .getByText(/^logout$/i)
        .click(),
    ]);

    // Verify user is logged out - command palette should show Login option
    await logoutPage.getByRole("button", { name: /search/i }).click();
    await expect(
      logoutPage.getByRole("dialog").getByText(/^login$/i),
    ).toBeVisible();
  });
});

test.describe("Command Palette - Course Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();
  });

  test("does not search with fewer than 2 characters", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("M");

    // Should not show course search results with single character
    await expect(dialog.getByText("Machine Learning")).not.toBeVisible();
  });

  test("shows course in results", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("machine");

    // Wait for results
    await expect(dialog.getByText("Machine Learning").first()).toBeVisible();

    // Course description should be visible
    await expect(
      dialog.getByText(/patterns|predictions|computers|identify/i).first(),
    ).toBeVisible();

    // Wait for and click the course result
    await dialog.getByText("Machine Learning").first().click();

    // Verify user sees course detail page (level: 1 for main title, not chapter headings)
    await expect(
      page.getByRole("heading", { level: 1, name: /machine learning/i }),
    ).toBeVisible();
  });

  test("shows No results found for non-matching query", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("xyznonexistent");

    await expect(dialog.getByText(/no results found/i)).toBeVisible();
  });

  test("handles rapid typing correctly", async ({ page }) => {
    const dialog = page.getByRole("dialog");

    // Type rapidly with corrections
    await dialog
      .getByPlaceholder(/search/i)
      .pressSequentially("Machi", { delay: 50 });

    await dialog.getByPlaceholder(/search/i).fill("Machine");

    // Should show correct results after debounce
    await expect(dialog.getByText("Machine Learning").first()).toBeVisible();
  });
});

test.describe("Command Palette - Keyboard Navigation", () => {
  test("focuses input on open", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    const input = page.getByPlaceholder(/search/i);
    await expect(input).toBeFocused();
  });

  test("arrow key navigation selects items", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Wait for cmdk to initialize and auto-select first item
    const firstOption = dialog.getByRole("option", { selected: true });
    await expect(firstOption).toBeVisible();
    const firstName = await firstOption.textContent();

    // Press ArrowDown and wait for selection to change
    await page.keyboard.press("ArrowDown");

    // Wait for the selection to move to a DIFFERENT item
    await expect(
      dialog.getByRole("option", { name: firstName as string, selected: true }),
    ).not.toBeVisible();

    // Verify a new item is selected
    const secondOption = dialog.getByRole("option", { selected: true });
    await expect(secondOption).toBeVisible();
    const secondName = await secondOption.textContent();
    expect(secondName).not.toBe(firstName);

    // Press ArrowUp and wait for selection to change back
    await page.keyboard.press("ArrowUp");

    // Wait for selection to move away from second item
    await expect(
      dialog.getByRole("option", {
        name: secondName as string,
        selected: true,
      }),
    ).not.toBeVisible();

    // Verify we're back on the first item
    await expect(
      dialog.getByRole("option", { name: firstName as string, selected: true }),
    ).toBeVisible();
  });

  test("Enter to select navigates correctly", async ({ page }) => {
    await page.goto("/courses"); // Start from courses page so Home navigation is verifiable
    await page.getByRole("button", { name: /search/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Type to filter to Home option, then press Enter to select it
    await page.getByPlaceholder(/search/i).fill("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Verify user sees home page content
    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });

  test("focus trap within dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();
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
    await page.getByRole("button", { name: /search/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Can interact with the palette
    await expect(dialog.getByPlaceholder(/search/i)).toBeVisible();
  });
});

test.describe("Command Palette - Accessibility", () => {
  test("has dialog role", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("has accessible title", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    const dialog = page.getByRole("dialog");
    const hasLabel = await dialog.evaluate(
      (el) =>
        el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
    );
    expect(hasLabel).toBe(true);
  });

  test("search button indicates keyboard shortcut", async ({ page }) => {
    await page.goto("/");

    const searchButton = page.getByRole("button", { name: /search/i });
    await expect(searchButton).toHaveAttribute("aria-keyshortcuts", /k/i);
  });

  /**
   * iOS Safari automatically zooms when focusing inputs with font-size < 16px.
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

    const fontSize = await input.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    );

    expect(fontSize).toBeGreaterThanOrEqual(16);

    await context.close();
  });
});
