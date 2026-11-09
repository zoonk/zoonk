import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { createMistakeLearner } from "./mistake-drill-days";
import { openAs } from "./study-day";

test.describe("Mistakes notebook", () => {
  test("practice counts toward today, stopped early too, the notebook shows it on the way back, and the next run takes the rest", async ({
    browser,
  }) => {
    const { user } = await createMistakeLearner({ causes: ["trap", "guess"] });
    const page = await openAs(browser, user);

    await page.goto("/mistakes");
    await expect(page.getByText("2 ready to practice")).toBeVisible();

    await page.getByRole("link", { name: /^Practice mistakes/u }).click();
    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
    ).toBeVisible();

    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();

    const done = page.getByRole("status").filter({ hasText: "Practice done" });
    await expect(done.getByRole("heading", { level: 2, name: "Practice done" })).toBeVisible();

    await expect
      .poll(() =>
        prisma.learningEvent.findMany({
          select: { brainPower: true, correctAnswers: true },
          where: { lessonKind: "mistakePractice", userId: user.id },
        }),
      )
      .toStrictEqual([{ brainPower: 2, correctAnswers: 1 }]);

    await expect
      .poll(() => prisma.dailyProgress.findFirst({ where: { userId: user.id } }))
      .toMatchObject({ brainPowerEarned: 2, correctAnswers: 1, interactiveCompleted: 1 });

    await page.getByRole("link", { name: /^Back(?! to)/u }).click();
    await expect(page).toHaveURL(/\/mistakes$/u);

    // Once, not retried: the browser's old copy shows until a fresh read replaces it. Visible only,
    // since Next keeps the page it left in the DOM, hidden.
    await expect(page.getByText("2 ready to practice").filter({ visible: true })).toHaveCount(0, {
      timeout: 1,
    });

    await expect(page.getByText("1 ready to practice")).toBeVisible();

    await page.getByRole("link", { name: /^Practice mistakes/u }).click();
    await expect(page.getByRole("heading", { name: "guess first question?" })).toBeVisible();

    await page.context().close();
  });
});
