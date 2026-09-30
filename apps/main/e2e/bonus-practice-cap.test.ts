import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/**
 * Bonus practice stops at two blocks a day: after both, "Practice now" on Progress says so in
 * place and adds nothing to the session. The browser runs in UTC, so the day it asks for is the
 * day the fixtures build.
 */

function findExtraBlocks(sessionId: string) {
  return prisma.studySessionBlock.findMany({
    where: { payload: { equals: true, path: ["extra"] }, sessionId },
  });
}

/** Today's session with the day's two bonus blocks already played. */
async function useUpBonusPractice({ goalId, userId }: { goalId: string; userId: string }) {
  const localDate = toUTCMidnight(new Date());

  const session =
    (await prisma.studySession.findUnique({
      where: { userGoalDate: { goalId, localDate, userId } },
    })) ?? (await studySessionFixture({ goalId, localDate, userId }));

  const blocks = await prisma.studySessionBlock.count({ where: { sessionId: session.id } });

  await Promise.all(
    ["first", "second"].map((key, index) =>
      studySessionBlockFixture({
        kind: "practice",
        payload: { areaId: `bonus-${key}`, extra: true, itemIds: [], skillIds: [] },
        position: blocks + index,
        sessionId: session.id,
        status: "completed",
      }),
    ),
  );

  return session;
}

test.describe("Bonus practice cap", () => {
  test(`"Practice now" after the day's two bonus blocks says so and adds none`, async ({
    browser,
  }) => {
    const user = await createE2EPersona(getBaseURL(), { mode: "fun", persona: "exam" });
    const session = await useUpBonusPractice({ goalId: user.goalId, userId: user.id });
    const page = await openAs(browser, user);

    await page.goto("/progress");
    await page.getByRole("button", { name: "Practice now" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "That's all the bonus practice for today." }),
    ).toBeVisible();

    await expect(page).toHaveURL(/\/progress$/u);

    const extra = await findExtraBlocks(session.id);
    expect(extra).toHaveLength(2);

    await page.context().close();
  });
});
