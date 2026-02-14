import { openDialog } from "@zoonk/e2e/helpers";
import { expect, test } from "./fixtures";

test.describe("Support page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/support");

    await expect(page.getByRole("heading", { name: /help & support/i })).toBeVisible();
  });

  test("shows page content with support options", async ({ page }) => {
    await expect(page.getByRole("link", { name: /github discussions/i })).toBeVisible();

    await expect(page.getByRole("button", { name: /contact support/i })).toBeVisible();
  });

  test("submit with valid data shows success message", async ({ page }) => {
    const supportButton = page.getByRole("button", { name: /contact support/i });
    const dialog = page.getByRole("dialog");
    await openDialog(supportButton, dialog);
    const emailInput = dialog.getByRole("textbox", { name: /email address/i });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/i });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.fill("test@example.com");
    await messageInput.fill("Test message");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/message sent successfully/i)).toBeVisible();
  });

  test("submit with invalid email shows validation error", async ({ page }) => {
    const supportButton = page.getByRole("button", { name: /contact support/i });
    const dialog = page.getByRole("dialog");
    await openDialog(supportButton, dialog);
    const emailInput = dialog.getByRole("textbox", { name: /email address/i });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/i });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.fill("invalid-email");
    await messageInput.fill("Test message");
    await dialog.getByRole("button", { name: /send message/i }).click();

    // Browser validation prevents submission - verify semantically:
    // 1. Dialog remains visible (form wasn't submitted)
    await expect(dialog).toBeVisible();

    // 2. Email input is focused (browser focuses invalid fields)
    await expect(emailInput).toBeFocused();
  });

  test("submit failure shows error message", async ({ page }) => {
    const supportButton = page.getByRole("button", { name: /contact support/i });
    const dialog = page.getByRole("dialog");
    await openDialog(supportButton, dialog);
    const emailInput = dialog.getByRole("textbox", { name: /email address/i });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/i });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.fill("test@example.com");

    // Whitespace passes HTML5 "required" but fails server-side when trimmed
    await messageInput.fill("   ");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/failed to send message/i)).toBeVisible();
  });
});

test.describe("Support page - Authenticated", () => {
  test("email field shows authenticated user's email", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/support");

    const supportButton = authenticatedPage.getByRole("button", { name: /contact support/i });
    const dialog = authenticatedPage.getByRole("dialog");
    await openDialog(supportButton, dialog);

    const emailInput = dialog.getByRole("textbox", { name: /email address/i });

    await expect(emailInput).toBeEnabled();

    // Should be pre-filled with user's email
    await expect(emailInput).toHaveValue(/e2e-progress@zoonk\.test/);
  });
});
