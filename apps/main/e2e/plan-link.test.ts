import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { z } from "zod";
import { expect, test } from "./fixtures";

/** Only the size of a plan's skill graph matters here. */
const graphSchema = z.object({ skills: z.array(z.unknown()) });

function skillCount(graph: unknown) {
  return graphSchema.parse(graph).skills.length;
}

/** A shared seeded persona's plan, which these tests only read through its link. */
async function findSeededPlan(email: string) {
  return prisma.plan.findFirstOrThrow({
    include: { goal: true },
    where: { goal: { user: { email } } },
  });
}

/**
 * A plan's link opened by someone else: the subject and the plan's shape, never the owner's name
 * or progress, noindex, and a way to start their own plan from it. The owner landing on their
 * Journey is in journey.test.ts, after sharing it.
 */
test.describe("Plan links", () => {
  test("visitors see the plan's shape without the owner, and onboarding starts from the plan", async ({
    page,
  }) => {
    const plan = await findSeededPlan("v2-exam@zoonk.test");

    await page.goto(`/plan-link/${plan.id}`);

    const subject = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";

    await expect(page.getByText("A study plan someone shared with you")).toBeVisible();
    await expect(page.getByText(/phases? · \d+ skills?/u)).toBeVisible();
    // An exam's phases have no name of their own: they're named by what they're for, as on the plan.
    await expect(page.getByText("Fill the gaps", { exact: true })).toBeVisible();
    await expect(page.getByText("Ana Souza")).toBeHidden();

    await expect
      .poll(async () =>
        page.evaluate(
          () => document.querySelector<HTMLMetaElement>("meta[name='robots']")?.content ?? "",
        ),
      )
      .toContain("noindex");

    await expectAccessibleScreen(page, "a shared plan");

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

    expect(copy.goal.userId).not.toBe(plan.goal.userId);
    expect(skillCount(copy.graph)).toBeGreaterThan(0);
    expect(skillCount(copy.graph)).toBeLessThanOrEqual(skillCount(plan.graph));
  });

  test("a signed-in learner starts their own plan from the link", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [plan] = await Promise.all([
      findSeededPlan("v2-learn@zoonk.test"),
      learningProfileFixture({ birthMonth: 3, birthYear: 1995, userId: noProgressUser.id }),
    ]);

    await page.goto(`/plan-link/${plan.id}`);

    await page.getByLabel("How much time a day?").selectOption("30");
    await page.getByRole("button", { name: "Start from this plan" }).click();

    await expect(page).toHaveURL(/\/journey$/u);

    await expect
      .poll(async () =>
        prisma.goal.count({ where: { dailyMinutes: 30, userId: noProgressUser.id } }),
      )
      .toBe(1);
  });
});
