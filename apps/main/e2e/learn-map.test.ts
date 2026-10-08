import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * What to study next once Lucas has finished his overview: the Journey says the plan is done and
 * starts the next level of the same course in one tap.
 */
test.describe("Study next", () => {
  test("continues at the next level once the plan is done", async ({ browser }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      await prisma.planItem.updateMany({
        data: { status: "done" },
        where: { kind: { in: ["chapter", "lesson"] }, plan: { goalId: user.goalId } },
      });

      await page.goto("/journey");

      const next = page.getByRole("region", { name: "You finished your plan" });
      await expect(next.getByText("Here's what to study next.")).toBeVisible();

      await next.getByRole("button", { name: "Continue at Beginner" }).click();

      await expect
        .poll(async () => {
          const goals = await prisma.goal.findMany({
            orderBy: { createdAt: "asc" },
            select: { status: true },
            where: { userId: user.id },
          });

          return goals.map((goal) => goal.status);
        })
        .toStrictEqual(["completed", "active"]);

      // The Journey reads the new goal, whose plan is being built.
      await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
      await expect(page).toHaveURL(/\/journey$/u);
    });
  });
});
