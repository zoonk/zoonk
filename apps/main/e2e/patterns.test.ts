import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

const TUESDAY = 2;
const FRIDAY = 5;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Builds one finished activity per daypart with an explicit learner-local hour
 * so Patterns assertions never inherit whichever local day and time happened
 * to create shared progress data.
 */
function buildLedgerRow({
  correctAnswers,
  endedAt,
  hour,
  incorrectAnswers,
  localDate,
  userId,
}: {
  correctAnswers: number;
  endedAt: Date;
  hour: number;
  incorrectAnswers: number;
  localDate: Date;
  userId: string;
}) {
  return {
    correctAnswers,
    endedAt,
    hour,
    incorrectAnswers,
    kind: "lesson" as const,
    localDate,
    startedAt: endedAt,
    userId,
    weekday: TUESDAY,
  };
}

/**
 * Creates one isolated learner whose strongest weekday and daypart are known.
 * The rolling-window dates only keep records current; the stored Tuesday,
 * Friday, and hour buckets are explicit so timezone changes cannot alter which
 * labels the page must select.
 */
async function createPatternsTestPage({ baseURL, browser }: { baseURL: string; browser: Browser }) {
  const user = await createE2EUser(baseURL, { orgRole: "member", withProgress: true });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today.getTime() - MS_PER_DAY);
  const endedAt = new Date(now.getTime() - MS_PER_DAY);
  const ledgerRow = { endedAt, localDate: yesterday, userId: user.id };

  await prisma.$transaction([
    prisma.dailyProgress.deleteMany({ where: { userId: user.id } }),
    prisma.learningEvent.deleteMany({ where: { userId: user.id } }),
    prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 9,
          date: today,
          dayOfWeek: TUESDAY,
          incorrectAnswers: 1,
          userId: user.id,
        },
        {
          correctAnswers: 1,
          date: yesterday,
          dayOfWeek: FRIDAY,
          incorrectAnswers: 9,
          userId: user.id,
        },
      ],
    }),
    prisma.learningEvent.createMany({
      data: [
        buildLedgerRow({ ...ledgerRow, correctAnswers: 9, hour: 9, incorrectAnswers: 1 }),
        buildLedgerRow({ ...ledgerRow, correctAnswers: 1, hour: 15, incorrectAnswers: 4 }),
        buildLedgerRow({ ...ledgerRow, correctAnswers: 2, hour: 21, incorrectAnswers: 3 }),
      ],
    }),
  ]);

  const browserContext = await browser.newContext({ storageState: user.storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

test.describe("Patterns", () => {
  test("shows every weekday, opening on the strongest, and every part of the day with the best one marked", async ({
    baseURL,
    browser,
  }) => {
    const { browserContext, page } = await createPatternsTestPage({ baseURL: baseURL!, browser });

    try {
      await page.goto("/patterns");

      await expect(page.getByText("When you answer best, over the last 90 days.")).toBeVisible();

      const weeklyRhythm = page.getByRole("region", { name: /weekly rhythm/iu });

      await expect(weeklyRhythm.getByRole("button")).toHaveCount(WEEKDAYS.length);

      await Promise.all(
        WEEKDAYS.map((weekday) =>
          expect(
            weeklyRhythm.getByRole("button", { name: new RegExp(weekday, "iu") }),
          ).toBeVisible(),
        ),
      );

      await expect(weeklyRhythm.getByRole("status")).toContainText(
        /you do better on tuesdays.*90% across 10 answers/iu,
      );

      await weeklyRhythm.getByRole("button", { name: /friday/iu }).click();

      await expect(weeklyRhythm.getByRole("status")).toContainText(
        /friday performance.*10% across 10 answers/iu,
      );

      // Night, morning, afternoon and evening, each with its share of right answers.
      const day = page.getByRole("region", { name: "Throughout the day" });

      await expect(day.getByRole("listitem")).toHaveCount(4);

      await expect(day.getByRole("listitem", { name: "Morning" })).toContainText(
        /90%\s*10 answers/u,
      );

      await expect(day.getByRole("listitem", { name: "Afternoon" })).toContainText(
        /20%\s*5 answers/u,
      );

      await expect(day.getByRole("listitem", { name: "Evening" })).toContainText(
        /40%\s*5 answers/u,
      );

      await expect(day.getByRole("listitem", { name: "Night" })).toContainText("No answers");
    } finally {
      await browserContext.close();
    }
  });
});
