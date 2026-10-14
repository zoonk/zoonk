import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EPersona, createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { expect, test } from "./fixtures";

/**
 * The learner's day comes from their goal's stored zone, wherever their device is: Today and the
 * session's actions read the same day. A learner who moved takes the device's zone before their
 * day starts; once they studied, the day stays the goal's until the next one.
 */

/** "Fri, Oct 9": a day as Today's compact header writes it. */
function headerDay(timeZone: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short",
  }).format(new Date());
}

function localDay(timeZone: string): Date {
  return getDateInTimeZone({ date: new Date(), timeZone });
}

/** A zone whose day isn't the goal's right now: far ahead of it, or far behind it early on. */
function zoneOnAnotherDay(goalZone: string): string {
  const zones = ["Pacific/Kiritimati", "Pacific/Pago_Pago"];
  return zones.find((zone) => localDay(zone).getTime() !== localDay(goalZone).getTime()) ?? "UTC";
}

/** Ana (ENEM, her goal in São Paulo) on a device whose day isn't hers. */
async function openAnaElsewhere(browser: Browser) {
  const user = await createE2EPersona(getBaseURL(), { persona: "exam" });
  const device = zoneOnAnotherDay(user.timeZone);

  const context = await browser.newContext({ storageState: user.storageState, timezoneId: device });

  return { context, device, page: await context.newPage(), user };
}

async function readGoalZone(user: E2EPersona) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
  return goal.timezone;
}

test.describe("The learner's day on a device in another zone", () => {
  test("keeps the day of a goal she studied today, and Continue opens her session", async ({
    browser,
  }) => {
    const { context, page, user } = await openAnaElsewhere(browser);

    try {
      await page.goto("/today");
      await expect(page.getByText(headerDay(user.timeZone), { exact: true })).toBeVisible();

      const card = page.getByRole("region", { name: "Today's session" });
      await card.getByRole("button", { name: /^Continue/u }).click();
      await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);

      await expect.poll(() => readGoalZone(user)).toBe(user.timeZone);
    } finally {
      await context.close();
    }
  });

  test("moves to the device's day while nothing was done yet today", async ({ browser }) => {
    const { context, device, page, user } = await openAnaElsewhere(browser);

    // Nothing yet today in São Paulo: no answer, no block opened or finished, the session not
    // started. Before her study hour, the seed dates today's activity minutes ago, which would keep
    // the session hers past midnight on the device's day.
    const today = { goalId: user.goalId, localDate: localDay(user.timeZone) };

    await Promise.all([
      prisma.attempt.deleteMany({ where: { localDate: today.localDate, userId: user.id } }),
      prisma.studySessionBlock.updateMany({
        data: { completedAt: null, startedAt: null, status: "pending" },
        where: { session: today },
      }),
      prisma.studySession.updateMany({
        data: { endedAt: null, startedAt: null, status: "planned" },
        where: today,
      }),
    ]);

    try {
      await page.goto("/today");

      await expect(page.getByText(headerDay(device), { exact: true })).toBeVisible();
      await expect.poll(() => readGoalZone(user)).toBe(device);
    } finally {
      await context.close();
    }
  });
});
