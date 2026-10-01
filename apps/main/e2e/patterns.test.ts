import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

const TIME_PERIODS = ["Night", "Morning", "Afternoon", "Evening"] as const;
const TUESDAY = 2;
const FRIDAY = 5;

const TIME_PERIOD_RANGES = [
  /12:00\s*AM.*6:00\s*AM/iu,
  /6:00\s*AM.*12:00\s*PM/iu,
  /12:00\s*PM.*6:00\s*PM/iu,
  /6:00\s*PM.*12:00\s*AM/iu,
] as const;

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
 * Creates one isolated learner in Fun whose strongest weekday and daypart are known.
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
  await showInMode(browserContext, { mode: "fun", userId: user.id });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

test.describe("Patterns", () => {
  test("shows every weekday and time period, selecting the strongest explicit weekday in Fun", async ({
    baseURL,
    browser,
  }) => {
    const { browserContext, page } = await createPatternsTestPage({ baseURL: baseURL!, browser });

    try {
      await page.goto("/patterns");
      await expectMode(page, "fun");

      await expect(
        page
          .getByRole("navigation", { name: "Your stats" })
          .getByRole("link", { name: "Patterns" }),
      ).toHaveAttribute("aria-current", "page");

      const weeklyRhythm = page.getByRole("region", { name: /weekly rhythm/iu });

      await expect(weeklyRhythm).toContainText(/past 90 days/iu);
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

      await expectAccessibleScreen(page, "Patterns");

      await weeklyRhythm.getByRole("button", { name: /friday/iu }).click();

      await expect(weeklyRhythm.getByRole("status")).toContainText(
        /friday performance.*10% across 10 answers/iu,
      );

      const dailyRhythm = page.getByRole("region", { name: /throughout the day/iu });

      await expect(dailyRhythm).toContainText(/past 90 days/iu);
      await expect(dailyRhythm.getByRole("article")).toHaveCount(TIME_PERIODS.length);

      await Promise.all(
        TIME_PERIODS.map((period, index) =>
          expect(dailyRhythm.getByRole("article", { name: period })).toContainText(
            TIME_PERIOD_RANGES[index]!,
          ),
        ),
      );

      const nightPattern = dailyRhythm.getByRole("article", { name: "Night" });
      const morningPattern = dailyRhythm.getByRole("article", { name: "Morning" });
      const afternoonPattern = dailyRhythm.getByRole("article", { name: "Afternoon" });
      const eveningPattern = dailyRhythm.getByRole("article", { name: "Evening" });

      await expect(nightPattern).toContainText(/no answers/iu);
      await expect(nightPattern).not.toContainText(/%/u);

      await expect(morningPattern).toContainText(/90%.*10 answers/iu);
      await expect(afternoonPattern).toContainText(/20%.*5 answers/iu);
      await expect(eveningPattern).toContainText(/40%.*5 answers/iu);
    } finally {
      await browserContext.close();
    }
  });
});
