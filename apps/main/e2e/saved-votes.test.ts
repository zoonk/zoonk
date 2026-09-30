import { prisma } from "@zoonk/db";
import { contentFeedbackFixture } from "@zoonk/testing/fixtures/feedback";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { setDeviceMode } from "./learn-personas";

/**
 * A vote is kept: a screen the learner voted on before shows that vote in its menu the next time
 * the lesson opens, and a new pick replaces it rather than adding a second one.
 */
test.describe("Saved votes", () => {
  test("a screen's earlier vote shows in its menu, and a new pick replaces it", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });
    const screen = { contentId: steps[0]!.id, userId: noProgressUser.id };
    await contentFeedbackFixture({ ...screen, vote: "down" });

    await setDeviceMode(page.context(), "focus");
    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    await page.getByRole("button", { name: "Screen options" }).click();

    const notHelpful = page.getByRole("menuitemcheckbox", { exact: true, name: "Not helpful" });
    const helpful = page.getByRole("menuitemcheckbox", { exact: true, name: "Helpful" });

    await expect(notHelpful).toBeChecked();
    await expect(helpful).not.toBeChecked();

    await helpful.click();

    await expect
      .poll(() => prisma.contentFeedback.findMany({ select: { vote: true }, where: screen }))
      .toStrictEqual([{ vote: "up" }]);
  });
});
