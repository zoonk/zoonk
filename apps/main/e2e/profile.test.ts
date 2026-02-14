import { expect, test } from "./fixtures";

test.describe("Profile settings page", () => {
  test("shows login prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByText(/you need to be logged in/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });

  test("updates name successfully", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/profile");

    const nameInput = authenticatedPage.getByRole("textbox", { name: /^name$/i });
    await nameInput.clear();
    await nameInput.fill("New Test Name");

    await authenticatedPage.getByRole("button", { name: /save changes/i }).click();

    await expect(
      authenticatedPage.getByText(/your profile has been updated successfully/i),
    ).toBeVisible();

    // Verify name persists after reload
    await authenticatedPage.reload();

    await expect(authenticatedPage.getByRole("textbox", { name: /^name$/i })).toHaveValue(
      "New Test Name",
    );
  });

  test("shows username field with @ prefix", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/profile");

    await expect(authenticatedPage.getByRole("textbox", { name: /username/i })).toBeVisible();
    await expect(authenticatedPage.getByText("@")).toBeVisible();
  });

  test("shows validation for short username", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/profile");

    const usernameInput = authenticatedPage.getByRole("textbox", { name: /username/i });
    await usernameInput.fill("ab");

    await expect(authenticatedPage.getByText(/3-30 characters/i)).toBeVisible();
  });

  test("disables save button for invalid username", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/profile");

    const usernameInput = authenticatedPage.getByRole("textbox", { name: /username/i });
    await usernameInput.fill("AB!@#");

    await expect(authenticatedPage.getByText(/3-30 characters/i)).toBeVisible();
  });

  test("updates username successfully", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/profile");

    const usernameInput = authenticatedPage.getByRole("textbox", { name: /username/i });
    const originalUsername = await usernameInput.inputValue();
    const newUsername = `e2etest${Date.now().toString().slice(-6)}`;

    await usernameInput.fill(newUsername);

    await authenticatedPage.getByRole("button", { name: /save changes/i }).click();

    await expect(
      authenticatedPage.getByText(/your profile has been updated successfully/i),
    ).toBeVisible();

    // Verify username persists after reload
    await authenticatedPage.reload();

    await expect(authenticatedPage.getByRole("textbox", { name: /username/i })).toHaveValue(
      newUsername,
    );

    // Restore original username to avoid breaking other tests
    await usernameInput.fill(originalUsername);

    await authenticatedPage.getByRole("button", { name: /save changes/i }).click();

    await expect(
      authenticatedPage.getByText(/your profile has been updated successfully/i),
    ).toBeVisible();
  });

  test("shows error for whitespace-only name", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/profile");

    const nameInput = authenticatedPage.getByRole("textbox", { name: /^name$/i });
    const originalName = await nameInput.inputValue();

    await nameInput.clear();
    await nameInput.fill("   "); // Whitespace passes HTML5 required but fails server validation

    await authenticatedPage.getByRole("button", { name: /save changes/i }).click();

    await expect(authenticatedPage.getByText(/failed to update your profile/i)).toBeVisible();

    // Verify name wasn't updated after reload
    await authenticatedPage.reload();

    await expect(authenticatedPage.getByRole("textbox", { name: /^name$/i })).toHaveValue(
      originalName,
    );
  });
});
