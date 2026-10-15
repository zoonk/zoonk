import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { fundedMockRelocationDayFixture } from "@zoonk/testing/fixtures/funded-mock-days";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

type WeeklyCard = {
  date: string;
  kind: string;
  planItemId: string | null;
  questions: number;
  timeLimitMinutes: number | null;
};

/** A day as plans and views label it (YYYY-MM-DD, UTC). */
function toDayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A view date, as its JSON carries it (`{ $date }`), as a day label. */
function readDayLabel(value: { $date: string }): string {
  return value.$date.slice(0, 10);
}

/**
 * Today's own read of the week's challenge (the mock the day selects) and the days "This week"
 * shows. The selected date follows the real calendar, so the test reads it instead of predicting
 * it.
 */
async function readWeeklyCard(page: Page) {
  const response = await page.request.get("/api/learner/views/today");
  const body = await response.json();
  const today = body.copy.view.today;
  const card = today.weeklyChallenge;

  return {
    card: {
      date: readDayLabel(card.date),
      kind: card.kind,
      planItemId: card.planItemId,
      questions: card.questions,
      timeLimitMinutes: card.timeLimitMinutes,
    } satisfies WeeklyCard,
    weekDays: today.session.week.days.map((day: { date: { $date: string } }) =>
      readDayLabel(day.date),
    ),
  };
}

test.describe("Today's weekly challenge after days away", () => {
  test("shows the mock the day selects, never the saved one Open replaces, and the same mock once opened", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    const seed = await fundedMockRelocationDayFixture({
      localDate: toUTCMidnight(new Date()),
      userId: user.id,
    });

    const context = await browser.newContext({
      storageState: user.storageState,
      timezoneId: "UTC",
    });

    const page = await context.newPage();
    const savedMock = `a[href*="/challenge/${seed.mock.id}"]`;

    const savedDay = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(
      seed.from,
    );

    // Opening the day never asks for a lesson to be written.
    await page.route("**/v1/library/lessons/*/generations", (route) => route.abort());

    try {
      await page.goto("/today");
      await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();

      // Before Open, Today's card is the mock the day selects: no saved row yet, on its own date.
      const before = await readWeeklyCard(page);
      expect(before.card.planItemId).toBeNull();
      expect(before.card.date).not.toBe(toDayLabel(seed.from));

      // The saved mock Open replaces is nowhere: no link to it, and the week doesn't mark its day.
      await expect(page.locator(savedMock)).toHaveCount(0);
      await expect(page.getByText(`${savedDay}: mock exam`, { exact: true })).toHaveCount(0);

      // The selected mock falls in a later week, so "This week" waits for it.
      expect(before.weekDays).not.toContain(before.card.date);

      await page.getByRole("button", { name: "Start session" }).click();

      await expect
        .poll(() => prisma.studySession.count({ where: { userId: user.id } }))
        .toBeGreaterThan(0);

      await page.goto("/today");

      // Once opened, the same mock is saved: the same date and facts, now with its own row.
      const after = await readWeeklyCard(page);

      expect(after.card).toMatchObject({
        date: before.card.date,
        kind: before.card.kind,
        planItemId: expect.any(String),
        questions: before.card.questions,
        timeLimitMinutes: before.card.timeLimitMinutes,
      });

      const saved = await prisma.planItem.findUniqueOrThrow({
        where: { id: after.card.planItemId ?? "" },
      });

      expect(toDayLabel(saved.scheduledFor ?? new Date(0))).toBe(before.card.date);
      await expect(page.locator(savedMock)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
