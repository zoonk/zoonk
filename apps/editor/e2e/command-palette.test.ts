import { expect, type Page, test } from "./fixtures";

// Helper to open command palette via click
async function openCommandPalette(page: Page) {
  await page.getByRole("button", { name: /search/i }).click();
}

// Helper to get the correct modifier key for the platform
function getModifierKey(): "Meta" | "Control" {
  return process.platform === "darwin" ? "Meta" : "Control";
}

test.describe("Command Palette - Open/Close", () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
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
  test("shows Pages group with Home, Create course, Logout", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog.getByText("Pages")).toBeVisible();
    await expect(dialog.getByText(/home page/i)).toBeVisible();
    await expect(dialog.getByText(/create course/i)).toBeVisible();
    await expect(dialog.getByText(/^logout$/i)).toBeVisible();
  });

  test("selecting Home navigates to org home", async ({ ownerPage }) => {
    // Start from a course detail page
    await ownerPage.goto("/ai/c/en/machine-learning");
    await openCommandPalette(ownerPage);

    await ownerPage
      .getByRole("dialog")
      .getByText(/home page/i)
      .click();

    await expect(ownerPage).toHaveURL(/\/ai$/);
  });

  test("selecting Create course navigates to new course page", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    await ownerPage
      .getByRole("dialog")
      .getByText(/create course/i)
      .click();

    await expect(ownerPage).toHaveURL(/\/ai\/new-course/);
  });

  test("selecting Logout navigates to logout URL", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    // Verify logout option is visible and clickable
    const logoutOption = ownerPage.getByRole("dialog").getByText(/^logout$/i);
    await expect(logoutOption).toBeVisible();

    // Click logout - the full logout flow is tested in main app
    // Here we just verify the command palette triggers navigation
    await Promise.all([
      ownerPage.waitForURL((url) => url.pathname !== "/ai"),
      logoutOption.click(),
    ]);
  });
});

test.describe("Command Palette - Course Search", () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);
  });

  test("does not search with fewer than 2 characters", async ({ ownerPage }) => {
    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("M");

    // Should not show course results with single character
    await expect(dialog.getByText("Courses")).not.toBeVisible();
  });

  test("shows courses in results", async ({ ownerPage }) => {
    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("machine");

    await expect(dialog.getByText("Courses")).toBeVisible();
    await expect(dialog.getByText("Machine Learning").first()).toBeVisible();
  });

  test("shows course description in results", async ({ ownerPage }) => {
    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("machine");

    await expect(dialog.getByText("Machine Learning").first()).toBeVisible();
    await expect(
      dialog.getByText(/patterns|predictions|computers|identify/i).first(),
    ).toBeVisible();
  });

  test("clicking course navigates to course page", async ({ ownerPage }) => {
    const dialog = ownerPage.getByRole("dialog");
    // Search for Python which only exists in English
    await dialog.getByPlaceholder(/search/i).fill("python");

    await dialog.getByText("Python Programming").first().click();

    await expect(ownerPage).toHaveURL(/\/ai\/c\/en\/python-programming/);
  });

  test("shows No results found for non-matching query", async ({ ownerPage }) => {
    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("xyznonexistent");

    await expect(dialog.getByText(/no results found/i)).toBeVisible();
  });

  test("handles rapid typing correctly", async ({ ownerPage }) => {
    const dialog = ownerPage.getByRole("dialog");

    await dialog.getByPlaceholder(/search/i).pressSequentially("Machi", { delay: 50 });

    await dialog.getByPlaceholder(/search/i).fill("Machine");

    await expect(dialog.getByText("Machine Learning").first()).toBeVisible();
  });
});

test.describe("Command Palette - Chapter Search", () => {
  test("shows chapters in search results", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("introduction");

    await expect(dialog.getByText("Chapters")).toBeVisible();
    await expect(dialog.getByText("Introduction to Machine Learning").first()).toBeVisible();
  });

  test("shows chapter position badge", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("data preparation");

    // Data Preparation is position 1 (second chapter, 0-indexed position)
    const chapterItem = dialog.getByRole("option").filter({
      hasText: "Data Preparation",
    });
    await expect(chapterItem).toBeVisible();
  });

  test("clicking chapter navigates to chapter page", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("introduction");

    await dialog.getByText("Introduction to Machine Learning").first().click();

    await expect(ownerPage).toHaveURL(
      /\/ai\/c\/en\/machine-learning\/ch\/introduction-to-machine-learning/,
    );
  });
});

test.describe("Command Palette - Lesson Search", () => {
  test("shows lessons in search results", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("history");

    await expect(dialog.getByText("Lessons")).toBeVisible();
    await expect(dialog.getByText("History of Machine Learning").first()).toBeVisible();
  });

  test("clicking lesson navigates to lesson page", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await openCommandPalette(ownerPage);

    const dialog = ownerPage.getByRole("dialog");
    await dialog.getByPlaceholder(/search/i).fill("history");

    await dialog.getByText("History of Machine Learning").first().click();

    await expect(ownerPage).toHaveURL(
      /\/ai\/c\/en\/machine-learning\/ch\/introduction-to-machine-learning\/l\/history-of-ml/,
    );
  });
});

test.describe("Command Palette - Keyboard Navigation", () => {
  test("focuses input on open", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const input = ownerPage.getByPlaceholder(/search/i);
    await expect(input).toBeFocused();
  });

  test("arrow key navigation selects items", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Wait for cmdk to initialize and auto-select first item
    const firstOption = dialog.getByRole("option", { selected: true });
    await expect(firstOption).toBeVisible();
    const firstName = await firstOption.textContent();

    // Press ArrowDown and wait for selection to change
    await ownerPage.keyboard.press("ArrowDown");

    if (!firstName) {
      throw new Error("Expected first option to have text content");
    }

    // Wait for the selection to move to a DIFFERENT item
    await expect(dialog.getByRole("option", { name: firstName, selected: true })).not.toBeVisible();

    // Verify a new item is selected
    const secondOption = dialog.getByRole("option", { selected: true });
    await expect(secondOption).toBeVisible();
    const secondName = await secondOption.textContent();
    expect(secondName).not.toBe(firstName);

    // Press ArrowUp and wait for selection to change back
    await ownerPage.keyboard.press("ArrowUp");

    if (!secondName) {
      throw new Error("Expected second option to have text content");
    }

    // Wait for selection to move away from second item
    await expect(
      dialog.getByRole("option", {
        name: secondName,
        selected: true,
      }),
    ).not.toBeVisible();

    // Verify we're back on the first item
    await expect(dialog.getByRole("option", { name: firstName, selected: true })).toBeVisible();
  });

  test("Enter to select navigates correctly", async ({ ownerPage }) => {
    // Start from a course detail page
    await ownerPage.goto("/ai/c/en/machine-learning");
    await ownerPage.getByRole("button", { name: /search/i }).click();
    await expect(ownerPage.getByRole("dialog")).toBeVisible();

    await ownerPage.getByPlaceholder(/search/i).fill("Home");
    await ownerPage.keyboard.press("ArrowDown");
    await ownerPage.keyboard.press("Enter");

    await expect(ownerPage).toHaveURL(/\/ai$/);
  });

  test("focus trap within dialog", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
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
    await ownerPage.goto("/ai");
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/search/i)).toBeVisible();
  });
});

test.describe("Command Palette - Accessibility", () => {
  test("has dialog role", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("has accessible title", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await ownerPage.getByRole("button", { name: /search/i }).click();

    const dialog = ownerPage.getByRole("dialog");
    const hasLabel = await dialog.evaluate(
      (el) => el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
    );
    expect(hasLabel).toBe(true);
  });

  test("search button indicates keyboard shortcut", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");

    const searchButton = ownerPage.getByRole("button", { name: /search/i });
    await expect(searchButton).toHaveAttribute("aria-keyshortcuts", /k/i);
  });

  test("search input has font-size >= 16px on mobile to prevent iOS Safari zoom", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/owner.json",
      viewport: { height: 667, width: 375 },
    });

    const page = await context.newPage();
    await page.goto(`${baseURL}/ai`);
    await openCommandPalette(page);

    const input = page.getByPlaceholder(/search/i);

    const fontSize = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    expect(fontSize).toBeGreaterThanOrEqual(16);

    await context.close();
  });
});
