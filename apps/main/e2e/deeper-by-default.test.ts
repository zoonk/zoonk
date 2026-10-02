import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";

/**
 * "Go deeper" by default, for learners who asked for a more technical register: a switch in
 * Appearance, on by itself when memory noticed it (and saying so), until the learner's own choice
 * replaces it. The player's side, explanations opening their deeper version first, is in the
 * player's browser tests.
 */
test.describe("Go deeper by default", () => {
  test("says when memory turned it on, and the learner's choice replaces it and stays", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await learningProfileFixture({
      experienceMode: "focus",
      memoryAsksDeeper: true,
      userId: noProgressUser.id,
    });

    await page.goto("/settings/appearance");

    const setting = page.getByRole("switch", { name: "Go deeper by default" });
    await expect(setting).toBeChecked();

    await expect(
      page.getByText("On because you asked for more technical explanations"),
    ).toBeVisible();

    await setting.click();
    await expect(setting).not.toBeChecked();

    await expect(
      page.getByText("Explanations open their more technical version first"),
    ).toBeVisible();

    await expect
      .poll(async () => {
        const profile = await prisma.userLearningProfile.findUnique({
          where: { userId: noProgressUser.id },
        });

        return profile?.deeperByDefault;
      })
      .toBe(false);

    await page.reload();
    await expect(page.getByRole("switch", { name: "Go deeper by default" })).not.toBeChecked();
  });
});
