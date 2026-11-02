import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { createMistakeLearner } from "./mistake-drill-days";
import { openAs } from "./study-day";

test.describe("Mistakes notebook", () => {
  test("practice counts toward today, stopped early too", async ({ browser }) => {
    const { user } = await createMistakeLearner({ causes: ["trap", "guess"] });
    const page = await openAs(browser, user);

    await page.goto("/mistakes/practice");
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

    await page.context().close();
  });
});
