import { readFile } from "node:fs/promises";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { expect, test } from "./fixtures";

test.describe("Account data export", () => {
  test("downloads the learner's data from the profile page", async ({
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
  });
});
