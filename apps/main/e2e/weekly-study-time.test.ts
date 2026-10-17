import { prisma } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { carryLessons, createStudyDay, openAs } from "./study-day";

test("Plan and Today show the same actual study time and weekly target", async ({ browser }) => {
  const { goal, user } = await createStudyDay();
  const today = toUTCMidnight(new Date());
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * MS_PER_DAY);

  await Promise.all([
    prisma.goal.update({ data: { createdAt: monday, dailyMinutes: 45 }, where: { id: goal.id } }),
    prisma.dailyProgress.create({
      data: { date: today, dayOfWeek: today.getUTCDay(), timeSpentSeconds: 3600, userId: user.id },
    }),
  ]);

  await carryLessons({ count: 2, goalId: goal.id });

  const page = await openAs(browser, user);

  await page.goto("/plan");
  await page.getByRole("button", { name: /^Pace/u }).filter({ visible: true }).click();

  const paceWeek = page
    .getByRole("dialog", { name: "Your pace" })
    .getByRole("region", { name: "This week" });

  await expect(paceWeek).toContainText("1 hr of 5 hr 15 min");

  await page.goto("/today");
  const todayWeek = page.getByRole("region", { name: "This week" });
  await expect(todayWeek).toContainText("1 hr of 5 hr 15 min studied this week");

  await page.context().close();
});
