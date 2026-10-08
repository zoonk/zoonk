import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";

test.describe("Profile settings page", () => {
  test("shows login prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByText(/you need to be logged in/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/iu })).toBeVisible();
  });

  test("holds the name and username, the learner's data and deleting the account", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: noProgressUser.id } });

    await expect(page.getByRole("textbox", { exact: true, name: "Name" })).toBeVisible();

    await expect(page.getByRole("textbox", { exact: true, name: "Username" })).toHaveValue(
      user.username ?? "",
    );

    await expect(page.getByRole("button", { name: "Download my data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
  });

  test("changes the username once it's free and follows the rule", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    const username = page.getByRole("textbox", { exact: true, name: "Username" });
    const save = page.getByRole("button", { exact: true, name: "Save" });

    await username.fill("ab");

    await expect(
      page.getByText("3-30 characters. Letters, numbers, and underscores only."),
    ).toBeVisible();

    await expect(save).toBeDisabled();

    await username.fill("admin");
    await expect(page.getByText("admin is already taken")).toBeVisible();
    await expect(save).toBeDisabled();

    const chosen = `e2e_new_${Date.now().toString().slice(-8)}`;
    await username.fill(chosen);
    await expect(page.getByText(`${chosen} is available`)).toBeVisible();
    await save.click();

    await expect(page.getByText("Saved.")).toBeVisible();

    await expect
      .poll(async () => {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: noProgressUser.id } });
        return user.username;
      })
      .toBe(chosen);

    await page.reload();
    await expect(page.getByRole("textbox", { exact: true, name: "Username" })).toHaveValue(chosen);
  });

  test("refuses a whitespace-only name, then updates the name", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    const nameInput = page.getByRole("textbox", { exact: true, name: "Name" });
    const originalName = await nameInput.inputValue();
    await expectAccessibleScreen(page, "the profile settings");

    await nameInput.clear();
    await nameInput.fill("   "); // Whitespace passes HTML5 required but fails server validation
    await page.getByRole("button", { exact: true, name: "Save" }).click();

    await expect(page.getByText("We couldn't save your profile. Try again.")).toBeVisible();

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: noProgressUser.id } }),
    ).resolves.toMatchObject({ name: originalName });

    await nameInput.fill("New Test Name");
    await page.getByRole("button", { exact: true, name: "Save" }).click();

    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();

    await expect(page.getByRole("textbox", { exact: true, name: "Name" })).toHaveValue(
      "New Test Name",
    );
  });
});
