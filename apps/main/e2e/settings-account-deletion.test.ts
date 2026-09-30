import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";

test.describe("Account deletion", () => {
  test("deletes the account and everything in it after a confirmation, then signs out", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await goalFixture({ title: "Pass the bar exam", userId: noProgressUser.id });
    await page.goto("/profile");

    await page.getByRole("button", { name: "Delete account" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
    await expect(dialog.getByText(/can't be undone/u)).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      prisma.user.findUnique({ where: { id: noProgressUser.id } }),
    ).resolves.not.toBeNull();

    await page.getByRole("button", { name: "Delete account" }).click();
    await dialog.getByRole("button", { name: "Delete my account" }).click();

    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    await expect
      .poll(() => prisma.user.findUnique({ where: { id: noProgressUser.id } }))
      .toBeNull();

    await expect(prisma.goal.count({ where: { userId: noProgressUser.id } })).resolves.toBe(0);
  });
});
