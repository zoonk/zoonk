import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { expectHydrated } from "./hydration";

test.describe("Account data", () => {
  test("deletes the account after a confirmation and signs the learner out", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/profile");

    const remove = page.getByRole("button", { name: "Delete account" });
    await expectHydrated(remove);
    await remove.click();

    const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
    await dialog.getByRole("button", { name: "Delete my account" }).click();

    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    await expect
      .poll(() => prisma.user.findUnique({ where: { id: noProgressUser.id } }))
      .toBeNull();
  });
});
