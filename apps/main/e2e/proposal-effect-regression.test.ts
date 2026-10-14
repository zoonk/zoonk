import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

test("a proposal sheet shows its diff, lessons first, before offering Apply", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

    await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
        source: "memory",
      },
      planId: plan.id,
      reason: "Shorter study days.",
      status: "proposed",
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/today");
    const suggestion = page.getByRole("region", { name: "Suggested change" });
    await suggestion.getByRole("button", { exact: true, name: "View" }).click();
    const sheet = page.getByRole("dialog");

    // Resting on Saturdays leaves lessons out: the diff leads with them, and the plan's end moving
    // a day beside them isn't said (Ana read "ends Nov 13 → Nov 12" next to 227 lessons left out).
    const lines = sheet.locator("[data-slot=diff-lines]").getByRole("listitem");
    await expect(lines.first()).toHaveText(/Leaves out [\d,.]+ lessons$/u);
    await expect(sheet.getByText(/Plan ends/u)).toHaveCount(0);
    await expect(sheet.getByRole("button", { exact: true, name: "Apply" })).toBeEnabled();
    // Opening the preview leaves the proposal waiting for the learner's decision.
    await expect(
      prisma.planChange.count({
        where: { planId: plan.id, reason: "Shorter study days.", status: "applied" },
      }),
    ).resolves.toBe(0);
  });
});
