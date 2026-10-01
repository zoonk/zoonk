import { expect, test } from "./fixtures";
import { expectMode } from "./learn-personas";
import { DAYS_TO_TEST, createClassTestDays, dayFromToday } from "./short-exam-fixtures";
import { openAs } from "./study-day";

/**
 * A class test three days away, read from the learner's slides: the plan goes day by day (the
 * exam map and gaps, practice, then the short mock the day before the test), and Today says which
 * day it is.
 */

function weekday(date: Date): string {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(date);
}

test.describe("A class test days away", () => {
  test("plans it day by day with the short mock the day before in Focus", async ({ browser }) => {
    const { user } = await createClassTestDays("focus");
    const page = await openAs(browser, user);
    const mockDay = dayFromToday(DAYS_TO_TEST - 1);

    await page.goto("/today");
    await expectMode(page, "focus");

    await expect(page.getByText("Day 1 of 3 · Exam map and gaps")).toBeVisible();

    await expect(page.getByText(`${weekday(mockDay)}: mock exam`)).toBeVisible();

    await page.goto("/plan");

    await expect(
      page.getByText(`A 3-day plan with a short mock on ${weekday(mockDay)}`),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Day 1 of 3: Exam map and gaps" }),
    ).toBeVisible();

    await expect(page.getByText("Day 3 of 3: Short mock and review")).toBeVisible();

    await page.context().close();
  });

  test("the day before says what it holds, with a class test's own checklist", async ({
    browser,
  }) => {
    const { user } = await createClassTestDays("fun", { days: 1 });
    const page = await openAs(browser, user);

    // The plan is built when Today first opens.
    await page.goto("/today");
    await expect(page.getByText(/^Biochemistry test is tomorrow/u).first()).toBeVisible();

    await page.goto("/exam");

    const moment = page.getByRole("region", { name: "Biochemistry test is tomorrow" });
    await expect(moment.getByText(/^Today goes to the topics that come up most/u)).toBeVisible();
    await expect(moment.getByText(/light review/u)).toHaveCount(0);

    await expect(
      page.getByText("What your teacher lets you bring, like a pen or a calculator"),
    ).toBeVisible();

    await expect(page.getByText("Photo ID and your registration card")).toHaveCount(0);
    await page.context().close();
  });
});
