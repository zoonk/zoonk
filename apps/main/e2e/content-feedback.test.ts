import { expect, test } from "./fixtures";

// Content feedback is tested on the course suggestions page where it's used
test.describe("Content Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/learn/test%20prompt");

    // Wait for content to load
    await expect(page.getByText("Introduction to Testing")).toBeVisible();
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

  test("submit with valid data shows success message", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel(/email/i);

    // Wait for dialog to be fully visible and email input to be enabled
    await expect(emailInput).toBeEnabled();

    await emailInput.fill("test@example.com");
    await dialog.getByLabel(/message/i).fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/message sent successfully/i)).toBeVisible();
  });

  test("submit with invalid email shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel(/email/i);

    // Wait for dialog to be fully visible and email input to be enabled
    await expect(emailInput).toBeEnabled();

    await emailInput.fill("invalid-email");
    await dialog.getByLabel(/message/i).fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    // Browser validation prevents submission - verify semantically:
    // 1. Dialog remains visible (form wasn't submitted)
    await expect(dialog).toBeVisible();

    // 2. Email input is focused (browser focuses invalid fields)
    await expect(emailInput).toBeFocused();
  });

  test("submit failure shows error message", async ({ page }) => {
    // Intercept server action requests and modify response to return error
    await page.route("**/*", async (route) => {
      const request = route.request();

      // Server actions use POST with Next-Action header
      if (
        request.method() === "POST" &&
        request.headers()["next-action"] !== undefined
      ) {
        // Fetch the real response first to get the correct format
        const response = await route.fetch();
        const body = await response.text();

        // Replace status:"success" with status:"error" in the RSC response
        const errorBody = body.replace(
          '"status":"success"',
          '"status":"error"',
        );

        await route.fulfill({
          body: errorBody,
          response,
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel(/email/i);

    // Wait for dialog to be fully visible and email input to be enabled
    await expect(emailInput).toBeEnabled();

    await emailInput.fill("test@example.com");
    await dialog.getByLabel(/message/i).fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/failed to send message/i)).toBeVisible();
  });
});

test.describe("Content Feedback - Authenticated", () => {
  test("email field shows authenticated user's email", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/en/learn/test%20prompt");
    // Wait for content to load
    await expect(
      authenticatedPage.getByText("Introduction to Testing"),
    ).toBeVisible();

    await authenticatedPage
      .getByRole("button", { name: /send feedback/i })
      .click();

    const emailInput = authenticatedPage.getByLabel(/email/i);

    // Wait for dialog to be fully visible and email input to be enabled
    await expect(emailInput).toBeEnabled();

    // Should be pre-filled with user's email
    await expect(emailInput).toHaveValue(/e2e-progress@zoonk\.test/);
  });
});
