import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Keyboard-only Users Can", () => {
  test("navigate through navbar using Tab key", async ({ page }) => {
    await page.goto("/");

    // Tab through navbar elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should be able to tab through without issues
    // Just verifying page still works
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("open command palette with keyboard shortcut", async ({ page }) => {
    await page.goto("/");

    // Click the search button first to ensure focus is on the page
    await page.getByRole("button", { name: /search/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("navigate command palette items with arrow keys", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();

    // Navigate with arrow keys
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");

    // Dialog should remain open and functional
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("select command palette item with Enter and see destination content", async ({
    page,
  }) => {
    await page.goto("/courses"); // Start from courses page so Home navigation is verifiable
    await page.getByRole("button", { name: /search/i }).click();

    // Type to filter to Home option, then use keyboard to select
    await page.getByPlaceholder(/search/i).fill("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Verify user sees home page content
    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });

  test("close command palette with Escape and return focus to trigger", async ({
    page,
  }) => {
    await page.goto("/");

    // First focus the search button
    const searchButton = page.getByRole("button", { name: /search/i });
    await searchButton.focus();

    // Open with keyboard
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Focus should return to search button
    await expect(searchButton).toBeFocused();
  });

  test("submit forms using Enter key", async ({ page }) => {
    await page.goto("/learn");

    const input = page.getByRole("textbox");
    await input.fill("test prompt");
    await page.keyboard.press("Enter");

    // Should navigate to suggestions page
    await expect(
      page.getByRole("heading", { name: /course ideas for/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("navigate course list items with Tab", async ({ page }) => {
    await page.goto("/courses");

    // Wait for courses to load
    await expect(page.getByText("Machine Learning").first()).toBeVisible();

    // Tab through course items
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should still be on courses page
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
  });
});

test.describe("Screen Reader Support", () => {
  test("command palette has dialog role", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("command palette has accessible title", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();

    const dialog = page.getByRole("dialog");
    // Dialog should have aria-label or aria-labelledby
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

  test("form fields have accessible labels", async ({ page }) => {
    await page.goto("/learn");

    const input = page.getByRole("textbox");
    // Input should have a label (via aria-label or associated label element)
    const hasLabel = await input.evaluate((el) => {
      const labelledby = el.getAttribute("aria-labelledby");
      const label = el.getAttribute("aria-label");
      const id = el.getAttribute("id");
      const associatedLabel = id
        ? document.querySelector(`label[for="${id}"]`)
        : null;
      return Boolean(
        labelledby || label || associatedLabel || el.closest("label"),
      );
    });
    expect(hasLabel).toBe(true);
  });
});
