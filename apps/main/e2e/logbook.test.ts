import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { createGoalLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const DAYS_PER_WEEK = 7;
const SUNDAY = 0;

/** Monday of the week with this date, as a UTC midnight. */
function getMonday(date: Date): Date {
  const daysSinceMonday = (date.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  return new Date(toUTCMidnight(date).getTime() - daysSinceMonday * MS_PER_DAY);
}

/**
 * The week the logbook tells: the last finished one, or this one on Sunday, when it's complete.
 */
function getToldWeekStart(): Date {
  const thisMonday = getMonday(new Date());
  const isSunday = new Date().getUTCDay() === SUNDAY;

  return isSunday ? thisMonday : new Date(thisMonday.getTime() - DAYS_PER_WEEK * MS_PER_DAY);
}

test.describe("Logbook", () => {
  test("tells the last finished week in the learner's own numbers, then back to studying", async ({
    browser,
  }) => {
    const { user } = await createGoalLearner();
    const weekStart = getToldWeekStart();

    await dailyProgressFixtureMany(
      [0, 2].map((day) => ({
        correctAnswers: 8,
        date: new Date(weekStart.getTime() + day * MS_PER_DAY),
        incorrectAnswers: 2,
        timeSpentSeconds: 900,
        userId: user.id,
      })),
    );

    const page = await openAs(browser, user);

    // The server and the browser format the week's dates differently unless they agree on spaces.
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/logbook");

    const range = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" })
      .formatRange(weekStart, new Date(weekStart.getTime() + (DAYS_PER_WEEK - 1) * MS_PER_DAY))
      .replaceAll("\u2009", " ");

    // The week in one line: its days, its time and its questions, against the week before.
    await expect(page.getByText(`Weekly summary · ${range}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /^What a week/u })).toBeVisible();
    await expect(page.getByRole("img", { name: "2 days studied" })).toBeVisible();
    await expect(page.getByText("30 min", { exact: true })).toBeVisible();
    await expect(page.getByText("20 questions", { exact: true })).toBeVisible();
    await expect(page.getByText("30 min more than the week before!")).toBeVisible();
    await expectAccessibleScreen(page, "the weekly summary");

    // Closing goes back to the buddy tab, where the summary is opened from.
    await expect(page.getByRole("link", { name: "Leave" })).toHaveAttribute("href", "/buddy");

    expect(pageErrors).toStrictEqual([]);

    // Enter follows the one next step, back to studying.
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/today$/u, { timeout: 1000 });
    }).toPass({ timeout: 5000 });

    await page.context().close();
  });

  test("a learner without a finished week yet waits for Sunday instead of a half-written week", async ({
    browser,
  }) => {
    const { user } = await createGoalLearner();
    const isSunday = new Date().getUTCDay() === SUNDAY;
    const page = await openAs(browser, user);

    await page.goto("/logbook");

    // On Sunday this week is complete: a learner who hasn't studied gets a quiet week, no blame.
    await expect(
      page.getByRole("heading", {
        name: isSunday ? "A quiet week" : "Your first summary comes on Sunday",
      }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Let's go" })).toHaveAttribute("href", "/today");

    await page.context().close();
  });
});
