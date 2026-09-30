import { randomUUID } from "node:crypto";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * The free plan's paywalls, split between Focus and Fun: a learner who started today's new
 * lessons sees when they come back and Plus as a choice, a free exam plan past its first week says
 * so on Today instead of lessons quietly disappearing, and a second goal explains the one-goal
 * limit.
 */
test.describe("Paywall", () => {
  test("the daily lesson allowance says when lessons come back and offers Plus", async ({
    browser,
  }) => {
    const [user, { lesson }] = await Promise.all([
      createE2EUser(getBaseURL()),
      playableLessonFixture(),
    ]);

    await Promise.all([
      learningProfileFixture({ experienceMode: "focus", userId: user.id }),
      usageRecordsFixture({ count: getFreePlanLimits().lessonsPerDay ?? 0, userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    await page.goto(`/learn/${lesson.id}`);

    await expect(
      page.getByRole("heading", { name: "That's all the new lessons for today" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "You can still review what you learned and practice your mistakes. New lessons open again tomorrow, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await page.context().close();
  });

  test("a free exam plan past its first week offers Plus on Today", async ({ browser }) => {
    const { goal, user } = await createStudyDay({ mode: "fun" });
    const days = getFreePlanLimits().examPrepDays ?? 0;

    await prisma.goal.update({
      data: { createdAt: new Date(Date.now() - (days + 1) * MS_PER_DAY) },
      where: { id: goal.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("complementary", { name: "Exam prep on the free plan" });

    await expect(note.getByText("Your free week of exam prep is over")).toBeVisible();

    await expect(note.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await page.context().close();
  });

  test("a free exam plan in its first week has no paywall on Today", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("region", { name: "This week" })).toBeVisible();

    await expect(
      page.getByRole("complementary", { name: "Exam prep on the free plan" }),
    ).toHaveCount(0);

    await page.context().close();
  });

  test("a second goal on the free plan explains the one-goal limit", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = `learn quantum physics ${randomUUID().slice(0, 8)}`;

    await Promise.all([
      learningProfileFixture({
        buddyGlasses: "round",
        buddyKind: "zu",
        experienceMode: "fun",
        userId: user.id,
      }),
      goalFixture({ status: "active", userId: user.id }),
      goalUnderstandingFixture({
        goal,
        result: {
          followUps: [],
          goals: [
            { kind: "learn", subject: "quantum physics", title: "Understand quantum physics" },
          ],
          route: "goals",
        },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/start");

    await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
    await page.getByRole("button", { name: "Start with your goal" }).click();
    await page.getByRole("button", { name: "Looks right" }).click();

    await expect(
      page.getByText(
        "The free plan follows one goal at a time. Pause your current goal to start this one, or get Plus for more.",
      ),
    ).toBeVisible();

    await page.context().close();
  });
});
