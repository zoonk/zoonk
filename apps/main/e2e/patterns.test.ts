import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

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
 * Builds answer rows with an explicit hour bucket so Patterns assertions never
 * inherit whichever local day and time happened to create shared progress data.
 */
function buildStepAttemptRows({
  answeredAt,
  count,
  hourOfDay,
  isCorrect,
  stepId,
  userId,
}: {
  answeredAt: Date;
  count: number;
  hourOfDay: number;
  isCorrect: boolean;
  stepId: string;
  userId: string;
}) {
  return Array.from({ length: count }, () => ({
    answer: { selectedOption: isCorrect ? 1 : 0 },
    answeredAt,
    dayOfWeek: TUESDAY,
    durationSeconds: 15,
    hourOfDay,
    isCorrect,
    stepId,
    userId,
  }));
}

/**
 * Creates one isolated learner whose strongest weekday and daypart are known.
 * The rolling-window dates only keep records current; the stored Tuesday,
 * Friday, and hour buckets are explicit so timezone changes cannot alter which
 * labels the page must select.
 */
async function createPatternsTestPage({ baseURL, browser }: { baseURL: string; browser: Browser }) {
  const user = await createE2EUser(baseURL, { orgRole: "member", withProgress: true });
  const existingAttempt = await prisma.stepAttempt.findFirstOrThrow({ where: { userId: user.id } });
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today.getTime() - MS_PER_DAY);
  const answeredAt = new Date(now.getTime() - MS_PER_DAY);

  const attempts = [
    ...buildStepAttemptRows({
      answeredAt,
      count: 9,
      hourOfDay: 9,
      isCorrect: true,
      stepId: existingAttempt.stepId,
      userId: user.id,
    }),
    ...buildStepAttemptRows({
      answeredAt,
      count: 1,
      hourOfDay: 9,
      isCorrect: false,
      stepId: existingAttempt.stepId,
      userId: user.id,
    }),
    ...buildStepAttemptRows({
      answeredAt,
      count: 1,
      hourOfDay: 15,
      isCorrect: true,
      stepId: existingAttempt.stepId,
      userId: user.id,
    }),
    ...buildStepAttemptRows({
      answeredAt,
      count: 4,
      hourOfDay: 15,
      isCorrect: false,
      stepId: existingAttempt.stepId,
      userId: user.id,
    }),
    ...buildStepAttemptRows({
      answeredAt,
      count: 2,
      hourOfDay: 21,
      isCorrect: true,
      stepId: existingAttempt.stepId,
      userId: user.id,
    }),
    ...buildStepAttemptRows({
      answeredAt,
      count: 3,
      hourOfDay: 21,
      isCorrect: false,
      stepId: existingAttempt.stepId,
      userId: user.id,
    }),
  ];

  await prisma.$transaction([
    prisma.dailyProgress.deleteMany({ where: { userId: user.id } }),
    prisma.stepAttempt.deleteMany({ where: { userId: user.id } }),
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
    prisma.stepAttempt.createMany({ data: attempts }),
  ]);

  const browserContext = await browser.newContext({ storageState: user.storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

/**
 * Opens Patterns at the shared phone size and verifies its two compact rhythm
 * visualizations do not force horizontal scrolling.
 */
async function expectPatternsToFitMobileViewport(page: Page) {
  await page.goto("/patterns");

  const dailyRhythm = page.getByRole("region", { name: /throughout the day/iu });
  const weeklyRhythm = page.getByRole("region", { name: /weekly rhythm/iu });

  await expect(weeklyRhythm).toBeVisible();
  await expect(dailyRhythm).toBeVisible();
  await expect(weeklyRhythm.getByRole("button")).toHaveCount(WEEKDAYS.length);
  await expect(dailyRhythm.getByRole("article")).toHaveCount(TIME_PERIODS.length);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  expect(hasHorizontalOverflow).toBe(false);
}

test.describe("Patterns", () => {
  test("unauthenticated visitors see a login prompt", async ({ page }) => {
    await page.goto("/patterns");

    await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
  });

  test("new learners see a start-learning prompt", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/patterns");

    await expect(
      userWithoutProgress.getByText(/start learning to track your progress/iu),
    ).toBeVisible();
  });

  test("shows every weekday and selects the strongest explicit weekday", async ({
    baseURL,
    browser,
  }) => {
    const { browserContext, page } = await createPatternsTestPage({ baseURL: baseURL!, browser });

    try {
      await page.goto("/patterns");

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

      await weeklyRhythm.getByRole("button", { name: /friday/iu }).click();

      await expect(weeklyRhythm.getByRole("status")).toContainText(
        /friday performance.*10% across 10 answers/iu,
      );
    } finally {
      await browserContext.close();
    }
  });

  test("shows every time period with its accuracy and answer count", async ({
    baseURL,
    browser,
  }) => {
    const { browserContext, page } = await createPatternsTestPage({ baseURL: baseURL!, browser });

    try {
      await page.goto("/patterns");

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

  test("appears as the active progress destination", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/patterns");

    await expect(
      authenticatedPage.getByRole("navigation").getByRole("link", { name: "Patterns" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("fits within a mobile viewport", async ({ browser, withProgressUser }) => {
    const browserContext = await browser.newContext({
      storageState: withProgressUser.storageState,
      viewport: { height: 812, width: 375 },
    });

    const patternsPage = await browserContext.newPage();

    try {
      await expectPatternsToFitMobileViewport(patternsPage);
    } finally {
      await browserContext.close();
    }
  });
});
