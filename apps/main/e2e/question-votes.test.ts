import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { createDrillSession, drillQuestion } from "./mistake-drill-days";
import { openAs } from "./study-day";

/**
 * Every question in today's session can be voted on from its "…" menu. While the menu or the
 * downvote sheet is open, the question's keys wait, so a number key can't answer it underneath.
 */
test.describe("Votes on session questions", () => {
  test("votes on a session question while its keys wait", async ({ browser }) => {
    const { drills, user } = await createDrillSession({ causes: ["trap"], mode: "focus" });
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });

    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    await expect(
      page.getByRole("heading", { name: drillQuestion("trap", "original") }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Question options" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("1");

    await page.getByRole("menuitemcheckbox", { exact: true, name: "Not helpful" }).press("Enter");
    const sheet = page.getByRole("dialog", { name: "What went wrong?" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("1");

    await expect
      .poll(() =>
        prisma.contentFeedback.findFirst({
          select: { contentKind: true, mode: true, vote: true },
          where: { contentId: drills[0]?.original.id, userId: user.id },
        }),
      )
      .toStrictEqual({ contentKind: "item", mode: "focus", vote: "down" });

    await expect(feedback).toBeHidden();

    await expect
      .poll(() =>
        prisma.attempt.count({ where: { itemId: drills[0]?.original.id, userId: user.id } }),
      )
      .toBe(0);

    // With the sheet closed, a number key answers again.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await page.keyboard.press("1");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.context().close();
  });
});
