import { expect, test } from "./fixtures";

test.describe("Display name settings page", () => {
  test("shows login prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/name");

    await expect(page.getByText(/you need to be logged in/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });

  test("updates display name successfully", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/name");

    const nameInput = authenticatedPage.getByLabel(/name/i);
    await nameInput.clear();
    await nameInput.fill("New Test Name");

    await authenticatedPage.getByRole("button", { name: /update name/i }).click();

    await expect(
      authenticatedPage.getByText(/your name has been updated successfully/i),
    ).toBeVisible();

    // Verify name persists after reload
    await authenticatedPage.reload();

    await expect(authenticatedPage.getByLabel(/name/i)).toHaveValue("New Test Name");
  });

  test("shows error for whitespace-only name", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/name");

    const nameInput = authenticatedPage.getByLabel(/name/i);
    const originalName = await nameInput.inputValue();

    await nameInput.clear();
    await nameInput.fill("   "); // Whitespace passes HTML5 required but fails server validation

    await authenticatedPage.getByRole("button", { name: /update name/i }).click();

    await expect(authenticatedPage.getByText(/failed to update your name/i)).toBeVisible();

    // Verify name wasn't updated after reload
    await authenticatedPage.reload();

    await expect(authenticatedPage.getByLabel(/name/i)).toHaveValue(originalName);
  });
});
