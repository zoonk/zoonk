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
  test("names the best day only when it stands out, and never calls a time best on too few answers", async ({
    baseURL,
    browser,
  }) => {
    const { browserContext, page } = await createPatternsTestPage({ baseURL: baseURL!, browser });

    try {
      await page.goto("/patterns");
      const main = page.getByRole("main");

      // Tuesday and Friday have enough answers to compare, and Tuesday stands out.
      const bestDay = main.getByRole("listitem").filter({ hasText: /^Best day/u });
      await expect(bestDay).toContainText(/Tuesday/u);
      await expect(bestDay).toContainText(/90%\s*·\s*10 answers/u);

      // Only the morning has enough answers, so no part of the day is called the best yet.
      const bestTime = main.getByRole("listitem").filter({ hasText: /^Best time/u });
      await expect(bestTime).toContainText("Not enough answers yet");
      await expect(main.getByText(/needs 10 answers to count/u)).toBeVisible();

      // Every day of the week as a row on one scale, its share and its answers.
      const week = page.getByRole("region", { name: "Throughout the week" });
      await expect(week.getByRole("listitem")).toHaveCount(WEEKDAYS.length);

      await expect(week.getByRole("listitem", { name: "Tuesday" })).toContainText(
        /10 answers\s*90%/u,
      );

      await expect(week.getByRole("listitem", { name: "Friday" })).toContainText(
        /10 answers\s*10%/u,
      );

      await expect(week.getByRole("listitem", { name: "Monday" })).toContainText("No answers");

      // Night, morning, afternoon and evening, each with its hours beside its name, its answers and share.
      const day = page.getByRole("region", { name: "Throughout the day" });

      await expect(day.getByRole("listitem")).toHaveCount(4);

      await expect(day.getByRole("listitem", { name: "Morning" })).toContainText(
        /10 answers\s*90%/u,
      );

      await expect(day.getByRole("listitem", { name: "Afternoon" })).toContainText(
        /5 answers\s*20%/u,
      );

      await expect(day.getByRole("listitem", { name: "Evening" })).toContainText(
        /5 answers\s*40%/u,
      );

      await expect(day.getByRole("listitem", { name: "Morning" })).toContainText("6 AM–12 PM");
      await expect(day.getByRole("listitem", { name: "Night" })).toContainText("No answers");
    } finally {
      await browserContext.close();
    }
  });
});
