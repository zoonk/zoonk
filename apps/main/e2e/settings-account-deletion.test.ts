import { readFile } from "node:fs/promises";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { expect, test } from "./fixtures";

test.describe("Account data", () => {
  test("downloads the learner's data, then deletes the account and everything in it after a confirmation", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      goalFixture({ title: "Pass the driving test", userId: noProgressUser.id }),
      memoryFactFixture({ statement: "Drives a manual car", userId: noProgressUser.id }),
    ]);

    await page.goto("/profile");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download my data" }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("zoonk-data.json");
    const exported: unknown = JSON.parse(await readFile((await download.path())!, "utf8"));

    expect(exported).toMatchObject({
      account: { email: noProgressUser.email },
      goals: [expect.objectContaining({ title: "Pass the driving test" })],
      memory: { facts: [expect.objectContaining({ statement: "Drives a manual car" })] },
    });

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
