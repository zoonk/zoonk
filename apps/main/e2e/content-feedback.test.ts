import { expect, test } from "@zoonk/e2e/fixtures";

// Content feedback is tested on the course suggestions page where it's used
test.describe("Content Feedback - Feedback Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/test%20prompt");
    // Wait for content to load
    await expect(page.getByText("Introduction to Testing")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shows Did you like this content heading", async ({ page }) => {
    await expect(page.getByText(/did you like this content/i)).toBeVisible();
  });

  test("shows thumbs up and thumbs down buttons", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /i liked it/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /i didn't like it/i }),
    ).toBeVisible();
  });

  test("clicking thumbs up highlights it", async ({ page }) => {
    const thumbsUp = page.getByRole("button", { name: /i liked it/i });
    await thumbsUp.click();

    // Should have green background class (but not just hover:bg-green)
    // The class string should contain " bg-green" indicating the selected state
    await expect(thumbsUp).toHaveClass(/\sbg-green-50\s/);
  });

  test("clicking thumbs down highlights it", async ({ page }) => {
    const thumbsDown = page.getByRole("button", { name: /i didn't like it/i });
    await thumbsDown.click();

    // Should have red background class (selected state)
    await expect(thumbsDown).toHaveClass(/\sbg-red-50\s/);
  });

  test("clicking same button twice keeps it selected", async ({ page }) => {
    const thumbsUp = page.getByRole("button", { name: /i liked it/i });
    await thumbsUp.click();
    await thumbsUp.click();

    // Should still be highlighted
    await expect(thumbsUp).toHaveClass(/\sbg-green-50\s/);
  });

  test("clicking different button switches selection", async ({ page }) => {
    const thumbsUp = page.getByRole("button", { name: /i liked it/i });
    const thumbsDown = page.getByRole("button", { name: /i didn't like it/i });

    await thumbsUp.click();
    await expect(thumbsUp).toHaveClass(/\sbg-green-50\s/);

    await thumbsDown.click();
    await expect(thumbsDown).toHaveClass(/\sbg-red-50\s/);
    // Thumbs up should no longer have green background (only hover state remains)
    await expect(thumbsUp).not.toHaveClass(/\sbg-green-50\s/);
  });
});

test.describe("Content Feedback - Feedback Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn/test%20prompt");
    // Wait for content to load
    await expect(page.getByText("Introduction to Testing")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shows Send feedback button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /send feedback/i }),
    ).toBeVisible();
  });

  test("clicking opens dialog with contact form", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    // Dialog should be visible with form
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/message/i)).toBeVisible();
  });

  test("form has email and message fields", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/email/i)).toBeVisible();
    await expect(dialog.getByLabel(/message/i)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /send message/i }),
    ).toBeVisible();
  });

  test("submit with empty fields shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /send message/i }).click();

    // Should show validation error or field should be marked invalid
    const emailInput = dialog.getByLabel(/email/i);
    // Browser validation will prevent submission
    await expect(emailInput).toHaveAttribute("required", "");
  });

  test("submit with valid data shows success message", async ({ page }) => {
    await page.getByRole("button", { name: /send feedback/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/email/i).fill("test@example.com");
    await dialog.getByLabel(/message/i).fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    // Should show success message
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
    // Should be pre-filled with user's email (member@zoonk.test)
    await expect(emailInput).toHaveValue(/member@zoonk\.test/);
  });
});
