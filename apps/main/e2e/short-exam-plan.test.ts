import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { DAYS_TO_TEST, createClassTestDays, dayFromToday } from "./short-exam-fixtures";
import { openAs } from "./study-day";

/**
 * A class test three days away, read from the learner's slides: the plan goes day by day (the
 * exam map and gaps, practice, then the short mock the day before the test), and Today says which
 * day it is.
 */

const DAYS_PER_WEEK = 7;

/** Every onboarding screen before the plan, so `/start/{goalId}` opens on it. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "age", "memory", "buddy", "placement"];

/** A month other than the test's, as a learner who misremembered it would name it. */
function getOtherMonth(date: Date): { examMonth: number; examYear: number } {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { examMonth: next.getUTCMonth() + 1, examYear: next.getUTCFullYear() };
}

function weekday(date: Date): string {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(date);
}

/** Whether a day falls in today's week, Monday to Sunday, as Today's week row shows it. */
function isThisWeek(date: Date): boolean {
  const mondayFirst = (new Date().getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const daysAway = Math.round((date.getTime() - dayFromToday(0).getTime()) / MS_PER_DAY);

  return mondayFirst + daysAway < DAYS_PER_WEEK;
}

test.describe("A class test days away", () => {
  test("plans it day by day with the short mock the day before", async ({ browser }) => {
    const { user } = await createClassTestDays();
    const page = await openAs(browser, user);
    const mockDay = dayFromToday(DAYS_TO_TEST - 1);

    await page.goto("/today");

    await expect(page.getByText("Day 1 of 3 · Exam map and gaps")).toBeVisible();

    // The mock's day is flagged on the week, and opens it, when it falls this week.
    await expect(
      page.getByRole("link", { name: new RegExp(`^Mock exam\\s*${weekday(mockDay)}`, "u") }),
    ).toHaveCount(isThisWeek(mockDay) ? 1 : 0);

    await page.goto("/journey");

    // Its phases are its days, the last one with the short mock.
    const days = page
      .getByRole("list", { name: "Your journey" })
      .getByRole("listitem")
      .filter({ hasText: /Days? \d+(?: to \d+)? of 3/u });

    await expect(days.first()).toContainText("Exam map and gaps");
    await expect(days.first()).toContainText("Day 1 of 3");
    await expect(days.last()).toContainText("Short mock and review");
    await expect(days.last()).toContainText("Day 3 of 3");

    await page.context().close();
  });

  test("its plan reveal counts the material's headings as its topics and never calls it a notice", async ({
    browser,
  }) => {
    // She named next month, but the test's own date is the one her plan counts down to.
    const { goal, user } = await createClassTestDays({
      details: { answered: ALL_ANSWERED, ...getOtherMonth(dayFromToday(DAYS_TO_TEST)) },
      headings: true,
    });

    const page = await openAs(browser, user);

    // The plan is built when Today first opens.
    await page.goto("/today");
    await expect(page.getByText("Day 1 of 3 · Exam map and gaps")).toBeVisible();

    await page.goto(`/start/${goal.id}`);

    await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();
    await page.getByRole("button", { name: /^3 topics from your material/u }).click();

    const structure = page.getByRole("dialog", { name: "What you'll study" });
    await expect(structure.getByText("Krebs cycle", { exact: true })).toBeVisible();
    await expect(page.getByText(/notice/iu)).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(structure).toBeHidden();
    await expect(page.getByText(/notice/iu)).toHaveCount(0);

    await page.context().close();
  });

  test("the day before is a full review on the free plan, and says only what she did", async ({
    browser,
  }) => {
    // Her plan started yesterday, which she didn't study: the test is tomorrow.
    const { user } = await createClassTestDays({ days: 1, plus: false, startedDaysAgo: 1 });
    const page = await openAs(browser, user);

    await page.goto("/today");

    const moment = page.getByRole("region", { name: "Biochemistry test is tomorrow" });

    await expect(
      moment.getByText(
        /^Today is a full review of every topic, in your test's format, your weakest first\. Then rest\./u,
      ),
    ).toBeVisible();

    await expect(moment.getByText(/prepared for this/u)).toHaveCount(0);

    const session = page.getByRole("region", { name: "Today's session" });
    await expect(session.getByRole("heading", { name: "Full review" })).toBeVisible();

    await expect(
      session.getByText(/questions? on every topic, your weakest first$/u),
    ).toBeVisible();

    await page.context().close();
  });

  test("the day before says what it holds, with a class test's own checklist", async ({
    browser,
  }) => {
    const { user } = await createClassTestDays({ days: 1 });
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
