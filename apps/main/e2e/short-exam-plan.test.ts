import { type Page } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { DAYS_TO_TEST, createClassTestDays, dayFromToday } from "./short-exam-fixtures";
import { checkWithEnter, openAs } from "./study-day";

/**
 * A class test three days away, read from the learner's slides: the plan goes day by day (the
 * exam map and gaps, practice, then the short mock the day before the test), and Today says which
 * day it is.
 */

const DAYS_PER_WEEK = 7;

/** Every onboarding screen before the plan, so `/start/{goalId}` opens on it. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

/** A month other than the test's, as a learner who misremembered it would name it. */
function getOtherMonth(date: Date): { examMonth: number; examYear: number } {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { examMonth: next.getUTCMonth() + 1, examYear: next.getUTCFullYear() };
}

function weekday(date: Date): string {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(date);
}

/** Whether a day falls in the learner's week, Monday to Sunday, as Today's week row shows it. */
function isThisWeek(date: Date): boolean {
  const today = dayFromToday(0);
  const mondayFirst = (today.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const daysAway = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY);

  return mondayFirst + daysAway < DAYS_PER_WEEK;
}

/** A day as the exam page writes its next mock's, at the row's end: "Tue, Oct 13". */
function mockRowDay(date: Date): string {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en", { timeZone: "UTC", ...options }).format(date);

  return `${format({ weekday: "short" })}, ${format({ day: "numeric", month: "short" })}`;
}

/**
 * Where the learner finds the short mock on the plan's first day. In this week, Today names it under
 * the week, opening it, and flags its day. In a later week (a plan started on a Saturday or a
 * Sunday), Today's week leaves it for its own week and the exam page has it with its date.
 */
async function expectMockShown(page: Page, mockDay: Date) {
  const day = weekday(mockDay);
  const todayRow = page.getByRole("link", { name: new RegExp(`^Mock exam\\s*${day}`, "u") });
  const dayFlag = page.getByText(`${day}: mock exam`, { exact: true });

  if (isThisWeek(mockDay)) {
    await expect(
      page.getByRole("link", { name: new RegExp(`^Mock exam\\s*${day} ·`, "u") }),
    ).toBeVisible();

    await expect(dayFlag).toHaveCount(1);
    return;
  }

  await expect(todayRow).toHaveCount(0);
  await expect(dayFlag).toHaveCount(0);

  await page.goto("/exam");

  await expect(
    page.getByRole("link", { name: new RegExp(`${mockRowDay(mockDay)}\\b`, "u") }),
  ).toBeVisible();
}

const TEST_IN_A_WEEK = 7;

/** The lessons days away left, offered for today when tomorrow is the test. */
const CATCH_UP_TODAY = /^You can still catch up on \d+ lessons? today, if you have time\.$/u;

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Moves everything about the goal back `days` days, as if the learner set it up then and studied
 * only its first day: its date and plan days, the plan's start and phases, and that day's study.
 */
async function moveGoalBack({
  days,
  goalId,
  userId,
}: {
  days: number;
  goalId: string;
  userId: string;
}) {
  const back = (date: Date) => new Date(date.getTime() - days * MS_PER_DAY);
  const backIso = (iso: string) => toIsoDay(back(new Date(`${iso}T00:00:00Z`)));
  const plan = await prisma.plan.findUniqueOrThrow({ include: { goal: true }, where: { goalId } });
  const settings = plan.settings as { startDate?: string };
  const phases = (plan.phases ?? []) as { endDate: string; startDate: string }[];
  const items = await prisma.planItem.findMany({ where: { planId: plan.id } });

  await prisma.studySession.deleteMany({ where: { goalId } });

  await Promise.all([
    prisma.goal.update({
      data: { targetDate: plan.goal.targetDate && back(plan.goal.targetDate) },
      where: { id: goalId },
    }),
    prisma.plan.update({
      data: {
        phases: phases.map((phase) => ({
          ...phase,
          endDate: backIso(phase.endDate),
          startDate: backIso(phase.startDate),
        })),
        settings: { ...settings, startDate: settings.startDate && backIso(settings.startDate) },
      },
      where: { id: plan.id },
    }),
    ...items.map((item) =>
      prisma.planItem.update({
        data: { scheduledFor: item.scheduledFor && back(item.scheduledFor) },
        where: { id: item.id },
      }),
    ),
    dailyProgressFixtureMany([{ date: dayFromToday(-days), timeSpentSeconds: 600, userId }]),
  ]);
}

/** Today's session done, every block of it. */
async function finishToday(goalId: string) {
  const today = await prisma.studySession.findFirstOrThrow({
    where: { goalId, localDate: dayFromToday(0) },
  });

  await Promise.all([
    prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { sessionId: today.id },
    }),
    prisma.studySession.update({
      data: { endedAt: new Date(), status: "completed" },
      where: { id: today.id },
    }),
  ]);
}

test.describe("A class test days away", () => {
  test("plans it day by day with the short mock the day before", async ({ browser }) => {
    const { user } = await createClassTestDays();
    const page = await openAs(browser, user);
    const mockDay = dayFromToday(DAYS_TO_TEST - 1);

    await page.goto("/today");

    const session = page.getByRole("region", { name: "Today's session" });
    await expect(session.getByText("Day 1 of 3", { exact: true })).toBeVisible();
    await expect(session.getByText("Exam map and gaps", { exact: true })).toBeVisible();

    await expectMockShown(page, mockDay);
    await page.goto("/plan");

    // A plan without subject pages keeps every phase with its days in the path.
    const days = page
      .getByRole("list", { name: "Your path" })
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

    await page.goto("/today");
    const session = page.getByRole("region", { name: "Today's session" });
    await expect(session.getByText("Day 1 of 3", { exact: true })).toBeVisible();
    await expect(session.getByText("Exam map and gaps", { exact: true })).toBeVisible();

    await page.goto(`/start/${goal.id}`);

    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "See topics" }).click();

    const structure = page.getByRole("dialog", { name: "What you'll study" });

    await expect(structure.getByRole("listitem")).toHaveText([
      "Enzymes",
      "Glycolysis",
      "Krebs cycle",
    ]);

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

    await expect(session.getByRole("listitem").filter({ hasText: "Full review" })).toHaveAttribute(
      "aria-current",
      "step",
    );

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

    await page.goto("/today");

    await expect(
      page.getByRole("heading", { name: "Biochemistry test is tomorrow" }),
    ).toBeVisible();

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

  // Pedro studied his class test's first day, skipped five and came back the day before: Today
  // had no full review, and said his 14 lessons, a saved mistake and the next lesson all came
  // "tomorrow", his test's day. The catch-up offer was gone once the session ended.
  test("the day before after days away is a full review, and nothing points to tomorrow", async ({
    browser,
  }) => {
    const { goal, user } = await createClassTestDays({ days: TEST_IN_A_WEEK, plus: false });
    const page = await openAs(browser, user);

    await page.goto("/today");
    await expect(page.getByText(/^Day 1 of 7/u)).toBeVisible();

    await moveGoalBack({ days: TEST_IN_A_WEEK - 1, goalId: goal.id, userId: user.id });
    await page.goto("/today");

    const session = page.getByRole("region", { name: "Today's session" });
    const catchUp = page.getByText(CATCH_UP_TODAY);

    await expect(session.getByRole("listitem").filter({ hasText: "Full review" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await expect(catchUp).toBeVisible();
    await expect(page.getByText(/come first tomorrow/u)).toHaveCount(0);

    await session.getByRole("button", { name: /^Start/u }).click();
    await expect(page.getByRole("heading", { name: /^Test question/u })).toBeVisible();
    await page.keyboard.press("2");
    await checkWithEnter(page);

    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect(feedback.getByText("Saved to your mistakes")).toBeVisible();
    await expect(feedback.getByText(/tomorrow/u)).toHaveCount(0);

    await finishToday(goal.id);
    await page.goto("/session");
    await expect(page.getByText("Tomorrow", { exact: true })).toHaveCount(0);

    // The lessons he skipped are still there for today once the review is done.
    await page.goto("/today");
    await expect(page.getByText("Today's session is complete")).toBeVisible();
    await expect(catchUp).toBeVisible();

    await page.context().close();
  });
});
