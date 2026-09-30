import { prisma } from "@zoonk/db";
import { suggestedGoalFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * A course from before goals, offered on Today as a goal to plan: "Build my plan" records the
 * answer and opens onboarding with the course as the goal. Saying "Not now" is in today.test.ts.
 */
test.describe("Suggested goal on Today", () => {
  test(`"Build my plan" starts onboarding with the course as the goal`, async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const suggestion = await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);

    await page.goto("/today");

    const card = page.getByRole("complementary", { name: "Suggested goal" });
    await expect(card.getByText("Continue Spanish?")).toBeVisible();
    await card.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(/\/start\?goal=Spanish$/u);

    await expect
      .poll(async () => {
        const row = await prisma.suggestedGoal.findUnique({ where: { id: suggestion.id } });
        return row?.status;
      })
      .toBe("accepted");

    await page.context().close();
  });
});
