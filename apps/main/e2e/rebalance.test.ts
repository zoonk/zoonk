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
  test("Fun: the buddy says it moved time on Today, and it can be undone", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page, user }) => {
      const change = await addRebalance(user);
      await page.goto("/today");

      const note = page.getByRole("region", { name: "Plan change" });
      await expect(note).toContainText("Otto moved time to Science, where it's needed most.");

      await note.getByRole("button", { name: "Undo" }).click();

      await expect(note).toBeHidden();
      await expect.poll(() => changeStatus(change.id)).toBe("undone");
    });
  });

  test("Focus: the same change as a plain line on Progress", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      await addRebalance(user);
      await page.goto("/progress");

      const note = page.getByRole("region", { name: "Plan change" });
      await expect(note).toContainText("More time for Science, where it's needed most.");
      await expect(note.getByRole("button", { name: "Undo" })).toBeVisible();
    });
  });
});
