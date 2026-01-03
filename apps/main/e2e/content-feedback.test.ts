import { expect, test } from "./fixtures";

// Content feedback is tested on the course suggestions page where it's used
test.describe("Content Feedback - Feedback Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/test%20prompt");
    // Wait for content to load
    await expect(page.getByText("Introduction to Testing")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shows feedback prompt and buttons", async ({ page }) => {
    await expect(page.getByText(/did you like this content/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /i liked it/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /i didn't like it/i }),
    ).toBeVisible();
  });

  test("clicking feedback button marks it as pressed", async ({ page }) => {
    const thumbsUp = page.getByRole("button", { name: /i liked it/i });
    const thumbsDown = page.getByRole("button", { name: /i didn't like it/i });

    // Initially neither should be pressed
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    // Click thumbs up
    await thumbsUp.click();
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    // Switch to thumbs down
    await thumbsDown.click();
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Content Feedback - Feedback Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/test%20prompt");
    await expect(page.getByText("Introduction to Testing")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("opens dialog with email and message fields", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/email/i)).toBeVisible();
    await expect(dialog.getByLabel(/message/i)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /send message/i }),
    ).toBeVisible();
  });

  test("submit with valid data shows success message", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/email/i).fill("test@example.com");
    await dialog.getByLabel(/message/i).fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/message sent successfully/i)).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Content Feedback - Authenticated", () => {
  test("email field shows authenticated user's email", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/learn/test%20prompt");
    // Wait for content to load
    await expect(
      authenticatedPage.getByText("Introduction to Testing"),
    ).toBeVisible({ timeout: 15_000 });

    await authenticatedPage
      .getByRole("button", { name: /send feedback/i })
      .click();

    const emailInput = authenticatedPage.getByLabel(/email/i);
    // Should be pre-filled with user's email
    await expect(emailInput).toHaveValue(/e2e-progress@zoonk\.test/);
  });
});
