import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { z } from "zod";
import { expect, test } from "./fixtures";
import { asPersona, expectMode } from "./learn-personas";

/** Only the size of a plan's skill graph matters here. */
const graphSchema = z.object({ skills: z.array(z.unknown()) });

function skillCount(graph: unknown) {
  return graphSchema.parse(graph).skills.length;
}

/**
 * A plan's link opened by someone else: the subject and the plan's shape, never the owner's name
 * or progress, noindex, and a way to start their own plan from it. The owner lands on their plan.
 */
test.describe("Plan links", () => {
  test("visitors see the plan's shape without the owner, and onboarding starts from the plan", async ({
    page,
  }) => {
    const owner = await createE2EPersona(getBaseURL(), { persona: "exam" });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: owner.goalId } });

    await page.goto(`/plan-link/${plan.id}`);

    const subject = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";

    await expect(page.getByText("A study plan someone shared with you")).toBeVisible();
    await expect(page.getByText(/phases? · \d+ skills?/u)).toBeVisible();
    await expect(page.getByText("Ana Souza")).toBeHidden();

    await expect
      .poll(async () =>
        page.evaluate(
          () => document.querySelector<HTMLMetaElement>("meta[name='robots']")?.content ?? "",
        ),
      )
      .toContain("noindex");

    // Onboarding reads the subject the way it reads any typed goal; the stored understanding skips the AI.
    await goalUnderstandingFixture({
      goal: subject,
      result: { followUps: [], goals: [{ kind: "exam", subject, title: subject }], route: "goals" },
    });

    await page.getByRole("link", { name: "Start from this plan" }).click();

    await expect(page).toHaveURL(new RegExp(`/start\\?goal=.+&plan=${plan.id}$`, "u"));
    await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue(subject);

    await page.getByRole("button", { name: "Start with your goal" }).click();
    await page.getByRole("button", { name: "Looks right" }).click();
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    const copy = await prisma.plan.findUniqueOrThrow({
      include: { goal: true },
      where: { goalId },
    });

    expect(copy.goal.userId).not.toBe(owner.id);
    expect(skillCount(copy.graph)).toBeGreaterThan(0);
    expect(skillCount(copy.graph)).toBeLessThanOrEqual(skillCount(plan.graph));
  });

  test("a signed-in learner starts their own plan from the link", async ({ browser }) => {
    const owner = await createE2EPersona(getBaseURL(), { persona: "hugeGoal" });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: owner.goalId } });

    await asPersona(browser, { mode: "focus", persona: "explain" }, async ({ page, user }) => {
      await page.goto(`/plan-link/${plan.id}`);

      await page.getByLabel("How much time a day?").selectOption("30");
      await page.getByRole("button", { name: "Start from this plan" }).click();

      await expect(page).toHaveURL(/\/plan$/u);
      await expectMode(page, "focus");

      await expect
        .poll(async () => prisma.goal.count({ where: { dailyMinutes: 30, userId: user.id } }))
        .toBe(1);
    });
  });

  test("the owner opening their own link lands on their plan", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      await page.goto(`/plan-link/${plan.id}`);

      await expect(page).toHaveURL(/\/plan$/u);
      await expectMode(page, "fun");

      // Fun calls the plan the Route; Focus names it by its date.
      await expect(page.getByRole("heading", { level: 1, name: "Route" })).toBeVisible();
    });
  });
});
