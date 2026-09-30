import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { createCheckpointLearner, playDuel } from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

/**
 * Wins the session's boss with every answer right, then continues to the end of the session. The
 * boss opens from its session, as today's session opens it, so it continues back to it.
 */
async function winBossAndContinue({
  block,
  page,
}: {
  block: { id: string; sessionId: string };
  page: Page;
}) {
  await page.goto(`/checkpoint/${block.id}?session=${block.sessionId}`);
  await page.getByRole("button", { name: /Take it on|Start/u }).click();
  await playDuel(page);
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/session$/u);
}

async function starShownAt(userId: string) {
  const milestone = await prisma.milestone.findFirstOrThrow({
    where: { key: "star", kind: "glasses", userId },
  });

  return milestone.shownAt;
}

test.describe("Ceremonies", () => {
  test("Fun: the first boss's glasses get one skippable ceremony at the end of the session", async ({
    browser,
  }) => {
    const { block, user } = await createCheckpointLearner({ mode: "fun" });
    const page = await openAs(browser, user);

    await winBossAndContinue({ block, page });

    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony).toBeVisible();
    await expect(ceremony.getByText("For beating your first boss.")).toBeVisible();

    await ceremony.getByRole("button", { name: "Skip" }).click();

    await expect(ceremony).toBeHidden();
    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Star glasses!" })).toHaveCount(0);

    await page.context().close();
  });

  test("Fun: 'Wear them' puts the new glasses on the buddy", async ({ browser }) => {
    const { block, user } = await createCheckpointLearner({ mode: "fun" });
    const page = await openAs(browser, user);

    await winBossAndContinue({ block, page });

    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await ceremony.getByRole("button", { name: "Wear them" }).click();
    await expect(ceremony).toBeHidden();

    await expect
      .poll(async () => {
        const profile = await prisma.userLearningProfile.findUnique({ where: { userId: user.id } });
        return profile?.buddyGlasses;
      })
      .toBe("star");

    await expect.poll(() => starShownAt(user.id)).not.toBeNull();
    await page.context().close();
  });

  test("Focus: the same milestone lands quietly, with no overlay", async ({ browser }) => {
    const { block, user } = await createCheckpointLearner({ mode: "focus" });
    const page = await openAs(browser, user);

    await winBossAndContinue({ block, page });

    await expect(page.getByText("First phase checkpoint passed")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    await page.context().close();
  });
});
