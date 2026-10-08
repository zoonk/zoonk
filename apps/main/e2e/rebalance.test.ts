import { prisma } from "@zoonk/db";
import { type E2EPersona } from "@zoonk/e2e/fixtures/personas";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * The rebalance a session left on the learner's plan: time moved to "Science", with the state its
 * undo restores, as the planner records any applied change.
 */
async function addRebalance(persona: E2EPersona) {
  const goal = await prisma.goal.findUniqueOrThrow({
    include: { plan: true },
    where: { id: persona.goalId },
  });

  const plan = goal.plan;

  if (!plan) {
    throw new Error("Expected the persona's plan");
  }

  return planChangeFixture({
    kind: "edited",
    payload: {
      before: {
        goal: {
          dailyMinutes: goal.dailyMinutes,
          targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
        },
        graph: plan.graph ?? {},
        settings: plan.settings ?? {},
      },
      operations: [{ areas: ["Science"], kind: "focusAreas" }],
      source: "preparation",
      versionAfter: plan.version,
    },
    planId: plan.id,
    reason: "Moved time to the area that needs it most.",
    status: "applied",
  });
}

async function changeStatus(changeId: string) {
  const change = await prisma.planChange.findUniqueOrThrow({ where: { id: changeId } });
  return change.status;
}

test.describe("Plan rebalance", () => {
  test("Today says it moved time, and it can be undone", async ({ browser }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const change = await addRebalance(user);
      await page.goto("/today");

      const note = page.getByRole("region", { name: "Plan change" });
      await expect(note).toContainText("More time for Science, where it's needed most.");

      await note.getByRole("button", { name: "Undo" }).click();

      await expect(note.getByRole("status")).toHaveText("Undone. Your plan is back as it was.");
      await expect.poll(() => changeStatus(change.id)).toBe("undone");
    });
  });
});
