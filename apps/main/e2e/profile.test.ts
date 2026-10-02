import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

test.describe("Profile settings page", () => {
  test("shows login prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByText(/you need to be logged in/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/iu })).toBeVisible();
  });

  test("refuses a whitespace-only name, then updates the name", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    const nameInput = page.getByRole("textbox", { name: /^name$/iu });
    const originalName = await nameInput.inputValue();
    await expectAccessibleScreen(page, "the profile settings");

    await nameInput.clear();
    await nameInput.fill("   "); // Whitespace passes HTML5 required but fails server validation
    await page.getByRole("button", { name: /save changes/iu }).click();

    await expect(page.getByText(/failed to update your profile/iu)).toBeVisible();

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: noProgressUser.id } }),
    ).resolves.toMatchObject({ name: originalName });

    await nameInput.fill("New Test Name");
    await page.getByRole("button", { name: /save changes/iu }).click();

    await expect(page.getByText(/your profile has been updated successfully/iu)).toBeVisible();

    // Verify name persists after reload
    await page.reload();

    await expect(page.getByRole("textbox", { name: /^name$/iu })).toHaveValue("New Test Name");
  });

  test("explains the username rules and disables save for an invalid one", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    const usernameInput = page.getByRole("textbox", { name: /username/iu });

    await expect(usernameInput).toBeVisible();
    await expect(page.getByText("@")).toBeVisible();

    await usernameInput.fill("ab");
    await expect(page.getByText(/3-30 characters/iu)).toBeVisible();

    await usernameInput.fill("AB!@#");

    await expect(page.getByText(/3-30 characters/iu)).toBeVisible();
    await expect(page.getByRole("button", { name: /save changes/iu })).toBeDisabled();
  });

  test("updates a Fun learner's username", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await showInMode(page.context(), { mode: "fun", userId: noProgressUser.id });
    await page.goto("/profile");
    await expectMode(page, "fun");

    const usernameInput = page.getByRole("textbox", { name: /username/iu });
    await expect(usernameInput).toBeVisible();
    await expectAccessibleScreen(page, "the Fun profile settings");

    const newUsername = `e2etest${Date.now().toString().slice(-6)}`;

    await usernameInput.fill(newUsername);

    await page.getByRole("button", { name: /save changes/iu }).click();

    await expect(page.getByText(/your profile has been updated successfully/iu)).toBeVisible();

    // Verify username persists after reload
    await page.reload();

    await expect(page.getByRole("textbox", { name: /username/iu })).toHaveValue(newUsername);
  });

  test("clears previous availability while a new username is debouncing", async ({
    userWithoutProgress: page,
  }) => {
    await page.clock.install();
    await page.goto("/profile");

    const usernameInput = page.getByRole("textbox", { name: /username/iu });
    const availableUsername = `available${Date.now().toString().slice(-8)}`;
    await usernameInput.fill(availableUsername);
    await expect(page.getByText(/is available/iu)).toBeVisible();

    /** Hold the debounce so a previous result cannot masquerade as the new input's validation. */
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await usernameInput.fill(`${availableUsername}next`);

    await expect(page.getByText(/checking/iu)).toBeVisible();
    await expect(page.getByText(/is available/iu)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /save changes/iu })).toBeDisabled();

    await usernameInput.fill(availableUsername);

    await expect(page.getByText(/checking/iu)).toBeVisible();
    await expect(page.getByText(/is available/iu)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /save changes/iu })).toBeDisabled();
  });
});
