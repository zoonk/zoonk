import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

const DAYS_PER_WEEK = 7;

/** Today's line once its study time is used up, as each catalog says it, by the day it's back. */
const LIMIT_LINES = {
  de: { day: (day: string) => `Bis ${day}!`, sentence: "Das war deine Lernzeit für heute." },
  en: { day: (day: string) => `See you ${day}!`, sentence: "That's today's study time." },
  fr: {
    day: (day: string) => `À ${day} !`,
    sentence: "Tu as atteint ton temps d’étude pour aujourd’hui.",
  },
  pt: {
    day: (day: string) => `Até ${day}!`,
    sentence: "Pronto, esse foi o tempo de estudo de hoje.",
  },
} as const;

/** Today's study time under a 30-minute daily limit, all used. */
async function useUpTodaysStudyTime(userId: string) {
  await Promise.all([
    prisma.userLearningProfile.update({ data: { dailyLimitMinutes: 30 }, where: { userId } }),
    dailyProgressFixtureMany([
      { date: toUTCMidnight(new Date()), timeSpentSeconds: 30 * 60, userId },
    ]),
  ]);
}

/** The plan studies on these days from today (0 is today) and rests on every other weekday. */
async function studyOnly({ days, goalId }: { days: number[]; goalId: string }) {
  const today = toUTCMidnight(new Date()).getUTCDay();
  const weekdays = new Set(days.map((day) => (today + day) % DAYS_PER_WEEK));

  await prisma.plan.update({
    data: {
      settings: {
        weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
          weekdays.has(weekday) ? 10 : 0,
        ),
      },
    },
    where: { goalId },
  });
}

/** A day from today, by name in a language, as Today names it. */
function weekdayIn({ days, lang }: { days: number; lang: keyof typeof LIMIT_LINES }) {
  const date = new Date(toUTCMidnight(new Date()).getTime() + days * MS_PER_DAY);
  return new Intl.DateTimeFormat(lang, { timeZone: "UTC", weekday: "long" }).format(date);
}

function limitLine(page: Page, { clause, sentence }: { clause: string; sentence: string }) {
  return page.getByRole("status").filter({ hasText: sentence }).filter({ hasText: clause });
}

test("Today past its study time says see you tomorrow when tomorrow is a study day", async ({
  browser,
}) => {
  const { user } = await createStudyDay();
  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await page.goto("/today");

  await expect(
    limitLine(page, { clause: "See you tomorrow!", sentence: LIMIT_LINES.en.sentence }),
  ).toBeVisible();

  await page.context().close();
});

test("Today past its study time names the next study day when tomorrow rests", async ({
  browser,
}) => {
  const { goal, user } = await createStudyDay();

  // Tomorrow rests and the day after studies: "tomorrow" would promise a day off. On a Friday or
  // a Saturday that day is in the next week, past the week the screen shows.
  await Promise.all([studyOnly({ days: [0, 2], goalId: goal.id }), useUpTodaysStudyTime(user.id)]);
  const page = await openAs(browser, user);
  await page.goto("/today");

  await expect(
    limitLine(page, {
      clause: LIMIT_LINES.en.day(weekdayIn({ days: 2, lang: "en" })),
      sentence: LIMIT_LINES.en.sentence,
    }),
  ).toBeVisible();

  await expect(page.getByText("See you tomorrow!")).toHaveCount(0);

  // The same line in German, French and Portuguese, on a phone, where it wraps.
  await page.setViewportSize({ height: 900, width: 390 });

  for (const lang of ["de", "fr", "pt"] as const) {
    const { day, sentence } = LIMIT_LINES[lang];
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await page.goto(`/${lang}/today`);
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await expect(
      limitLine(page, { clause: day(weekdayIn({ days: 2, lang })), sentence }),
    ).toBeVisible();
  }

  await page.context().close();
});
