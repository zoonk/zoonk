import { prisma } from "@zoonk/db";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { toUTCMidnight } from "@zoonk/utils/date";
import { calculateDateRanges } from "@zoonk/utils/date-ranges";

const DAYS_PER_GROUP = 5;
const CURRENT_MONTH_CORRECT = 17;
const PREVIOUS_MONTH_CORRECT = 13;
const CURRENT_MONTH_ENERGY = 75;
const CURRENT_MONTH_FULL_ENERGY = 100;
const PREVIOUS_MONTH_ENERGY = 65;
const CURRENT_MONTH_INCORRECT = 3;
const PREVIOUS_MONTH_INCORRECT = 7;
const COMPLETED_LESSON_DURATION_SECONDS = 120;
const COMPLETED_LESSON_START_OFFSET_SECONDS = 180;

const ALL_PERIODS = ["month", "year"] as const;

/**
 * The authenticated e2e user needs one visible full-energy day so the Energy
 * insight card proves a non-zero count without changing the broader chart data.
 */
function getEnergyAtEnd({ dayIndex, isCurrent }: { dayIndex: number; isCurrent: boolean }) {
  if (isCurrent && dayIndex === 1) {
    return CURRENT_MONTH_FULL_ENERGY;
  }

  return isCurrent ? CURRENT_MONTH_ENERGY : PREVIOUS_MONTH_ENERGY;
}

/**
 * The Level learning-days card and the Activity calendar count DailyProgress
 * completion rows, so the fixture marks the same current-day row that
 * represents the completed lesson.
 */
function getLessonsCompleted({ dayIndex, isCurrent }: { dayIndex: number; isCurrent: boolean }) {
  if (isCurrent && dayIndex === 0) {
    return 1;
  }

  return 0;
}

/**
 * The visible total-learning-time cards should match the completed lesson row
 * seeded for the authenticated e2e learner, so only that completed current-day
 * progress row receives a duration.
 */
function getTimeSpentSeconds({ dayIndex, isCurrent }: { dayIndex: number; isCurrent: boolean }) {
  if (isCurrent && dayIndex === 0) {
    return COMPLETED_LESSON_DURATION_SECONDS;
  }

  return 0;
}

/**
 * Build a small but stable group of dates for a reporting window.
 * The e2e progress dashboards only need enough rows to exercise grouping,
 * comparisons, and gap handling. Centralizing those rows here keeps account
 * creation helpers focused on auth setup instead of chart seed details.
 */
function buildGroupDates(today: Date, range: { start: Date; end: Date }, isCurrent: boolean) {
  const midpointMs = range.start.getTime() + (range.end.getTime() - range.start.getTime()) / 2;
  const midpoint = new Date(midpointMs);
  const baseDate = isCurrent ? today : midpoint;

  return Array.from({ length: DAYS_PER_GROUP }, (_, dayIndex) => {
    const date = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() - dayIndex),
    );

    if (date < range.start || date > range.end) {
      return null;
    }

    return {
      brainPowerEarned: 250,
      correctAnswers: isCurrent ? CURRENT_MONTH_CORRECT : PREVIOUS_MONTH_CORRECT,
      date,
      energyAtEnd: getEnergyAtEnd({ dayIndex, isCurrent }),
      incorrectAnswers: isCurrent ? CURRENT_MONTH_INCORRECT : PREVIOUS_MONTH_INCORRECT,
      lessonsCompleted: getLessonsCompleted({ dayIndex, isCurrent }),
      staticCompleted: getLessonsCompleted({ dayIndex, isCurrent }),
      timeSpentSeconds: getTimeSpentSeconds({ dayIndex, isCurrent }),
    };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

/**
 * Create daily progress rows that cover every supported chart period.
 * This gives the e2e progress pages enough historical data to verify daily,
 * monthly, and comparison states with one shared seed path.
 */
function buildDailyProgressInputs(today: Date, userId: string) {
  const dateEntries = ALL_PERIODS.flatMap((period) => {
    const { current, previous } = calculateDateRanges(period, 0);
    return [...buildGroupDates(today, current, true), ...buildGroupDates(today, previous, false)];
  });

  const seen = new Set<string>();

  return dateEntries
    .filter(({ date }) => {
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((entry) => ({ ...entry, userId }));
}

const DAY_PART_CONFIGS = [
  { correct: 9, hourOfDay: 9, incorrect: 1 },
  { correct: 8, hourOfDay: 15, incorrect: 2 },
  { correct: 7, hourOfDay: 21, incorrect: 3 },
];

/**
 * Seed the learning ledger rows: one finished activity per day part, which
 * Patterns reads by learner-local hour, plus the completed lesson itself.
 */
async function createLearningEvents({
  now,
  today,
  userId,
}: {
  now: Date;
  today: Date;
  userId: string;
}) {
  const startedAt = new Date(now.getTime() - COMPLETED_LESSON_START_OFFSET_SECONDS * 1000);

  await prisma.learningEvent.createMany({
    data: [
      ...DAY_PART_CONFIGS.map((config) => ({
        correctAnswers: config.correct,
        endedAt: now,
        hour: config.hourOfDay,
        incorrectAnswers: config.incorrect,
        kind: "review" as const,
        localDate: today,
        startedAt,
        userId,
        weekday: today.getUTCDay(),
      })),
      {
        endedAt: new Date(now.getTime() - 60 * 1000),
        hour: now.getUTCHours(),
        kind: "lesson" as const,
        lessonKind: "explanation",
        localDate: today,
        seconds: COMPLETED_LESSON_DURATION_SECONDS,
        startedAt,
        userId,
        weekday: today.getUTCDay(),
      },
    ],
  });
}

/**
 * Seed the progress data used by account-level e2e tests: Energy and Brain
 * Power, daily totals for every chart period, and the ledger rows Patterns and
 * Activity read, including one finished lesson today.
 */
export async function createE2EProgressData(userId: string): Promise<void> {
  const now = new Date();
  const today = toUTCMidnight(now);

  await userProgressFixture({ currentEnergy: 75, totalBrainPower: 15_000n, userId });
  await dailyProgressFixtureMany(buildDailyProgressInputs(today, userId));
  await createLearningEvents({ now, today, userId });
}
