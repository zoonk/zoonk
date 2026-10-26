import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";

test.describe("Account data", () => {
  test("deletes the account after a confirmation and signs the learner out", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    await page.getByRole("button", { name: "Delete account" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
    await dialog.getByRole("button", { name: "Delete my account" }).click();

    // Back on the home page, signed out.
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    await expect
      .poll(() => prisma.user.findUnique({ where: { id: noProgressUser.id } }))
      .toBeNull();
  });
});
