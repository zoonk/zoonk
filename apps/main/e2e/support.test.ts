import { expect, test } from "./fixtures";

test.describe("Support page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/support");

    await expect(
      page.getByRole("heading", { name: /help & support/i }),
    ).toBeVisible();
  });

  test("shows page content with support options", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /github discussions/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /contact support/i }),
    ).toBeVisible();
  });

  test("submit with valid data shows success message", async ({ page }) => {
    await page.getByRole("button", { name: /contact support/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel(/email/i);
    await expect(emailInput).toBeEnabled();
    await emailInput.fill("test@example.com");
    await dialog.getByLabel(/message/i).fill("Test message");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/message sent successfully/i)).toBeVisible();
  });

  test("submit with invalid email shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: /contact support/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel(/email/i);
    await expect(emailInput).toBeEnabled();
    await emailInput.fill("invalid-email");
    await dialog.getByLabel(/message/i).fill("Test message");
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

    await page.getByRole("button", { name: /contact support/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel(/email/i);
    await expect(emailInput).toBeEnabled();
    await emailInput.fill("test@example.com");
    await dialog.getByLabel(/message/i).fill("Test message");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/failed to send message/i)).toBeVisible();
  });
});

test.describe("Support page - Authenticated", () => {
  test("email field shows authenticated user's email", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/support");

    await authenticatedPage
      .getByRole("button", { name: /contact support/i })
      .click();

    const emailInput = authenticatedPage
      .getByRole("dialog")
      .getByLabel(/email/i);

    await expect(emailInput).toBeEnabled();

    // Should be pre-filled with user's email
    await expect(emailInput).toHaveValue(/e2e-progress@zoonk\.test/);
  });
});
