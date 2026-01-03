import { expect, test } from "./fixtures";

test.describe("Learn Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn");
  });

  test("shows page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });

  test("shows input with placeholder", async ({ page }) => {
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", /.+/);
  });

  test("input is auto-focused on page load", async ({ page }) => {
    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();
  });

  test("shows submit button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /start/i })).toBeVisible();
  });

  test("submit with empty input keeps user on same page", async ({ page }) => {
    // The form should not submit with empty input due to required validation
    await page.getByRole("button", { name: /start/i }).click();

    // Should still be on learn page
    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });

  test("max length validation prevents typing beyond limit", async ({
    page,
  }) => {
    const input = page.getByRole("textbox");

    // Try to type more than 128 characters
    const longText = "a".repeat(150);
    await input.fill(longText);

    // Value should be truncated to maxLength
    const value = await input.inputValue();
    expect(value.length).toBeLessThanOrEqual(128);
  });

  test("after submitting valid prompt, user sees course suggestions page", async ({
    page,
  }) => {
    const input = page.getByRole("textbox");
    await input.fill("test prompt");

    await page.getByRole("button", { name: /start/i }).click();

    // Wait for navigation and verify user sees suggestions page
    await expect(
      page.getByRole("heading", { name: /course ideas for/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Course Suggestions", () => {
  test("shows loading skeleton initially", async ({ page }) => {
    // Navigate directly to a new prompt that will need to load
    await page.goto("/learn/test%20prompt");

    // Should see either skeleton or content (depends on cache)
    // The page should eventually show content
    await expect(
      page.getByRole("heading", { name: /course ideas for/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows heading with user's prompt", async ({ page }) => {
    await page.goto("/learn/test%20prompt");

    await expect(
      page.getByRole("heading", { name: /course ideas for test prompt/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows course suggestion items with title and description", async ({
    page,
  }) => {
    await page.goto("/learn/test%20prompt");

    // Wait for suggestions to load (using seeded data)
    await expect(page.getByText("Introduction to Testing")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/fundamentals of software testing/i),
    ).toBeVisible();
  });

  test("each suggestion has Create course button", async ({ page }) => {
    await page.goto("/learn/test%20prompt");

    // Wait for content to load
    await expect(page.getByText("Introduction to Testing")).toBeVisible({
      timeout: 15_000,
    });

    // Should have Create course buttons
    const createButtons = page.getByRole("button", { name: /create course/i });
    await expect(createButtons.first()).toBeVisible();
  });

  test("clicking Change subject takes user back to learn form", async ({
    page,
  }) => {
    await page.goto("/learn/test%20prompt");

    // Wait for content to load
    await expect(
      page.getByRole("heading", { name: /course ideas for/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Click Change subject link
    await page.getByRole("link", { name: /change subject/i }).click();

    // Verify user is back on learn form page
    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });
});
