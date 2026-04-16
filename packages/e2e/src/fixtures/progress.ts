import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { calculateDateRanges } from "@zoonk/utils/date-ranges";
import { getAiOrganization } from "./orgs";

const SHORT_UUID_LENGTH = 8;
const DAYS_PER_GROUP = 5;
const CURRENT_MONTH_CORRECT = 17;
const PREVIOUS_MONTH_CORRECT = 13;
const CURRENT_MONTH_ENERGY = 75;
const PREVIOUS_MONTH_ENERGY = 65;
const CURRENT_MONTH_INCORRECT = 3;
const PREVIOUS_MONTH_INCORRECT = 7;
const COMPLETED_ACTIVITY_DURATION_SECONDS = 120;
const COMPLETED_ACTIVITY_START_OFFSET_SECONDS = 180;

const ALL_PERIODS = ["month", "6months", "year"] as const;

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

  return Array.from({ length: DAYS_PER_GROUP }, (_, i) => {
    const date = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() - i),
    );

    if (date < range.start || date > range.end) {
      return null;
    }

    return {
      brainPowerEarned: 250,
      correctAnswers: isCurrent ? CURRENT_MONTH_CORRECT : PREVIOUS_MONTH_CORRECT,
      date,
      energyAtEnd: isCurrent ? CURRENT_MONTH_ENERGY : PREVIOUS_MONTH_ENERGY,
      incorrectAnswers: isCurrent ? CURRENT_MONTH_INCORRECT : PREVIOUS_MONTH_INCORRECT,
    };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

/**
 * Create daily progress rows that cover every supported chart period.
 * This gives the e2e progress pages enough historical data to verify daily,
 * weekly, monthly, and comparison states with one shared seed path.
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

/**
 * Seed a small spread of step attempts across multiple day parts.
 * The progress summaries depend on answer counts and hour-of-day buckets, so
 * this helper creates that coverage once instead of repeating it in browser setup.
 */
async function createStepAttempts(stepId: bigint, userId: string, now: Date) {
  const configs = [
    { correct: 9, hourOfDay: 9, incorrect: 1 },
    { correct: 8, hourOfDay: 15, incorrect: 2 },
    { correct: 7, hourOfDay: 21, incorrect: 3 },
  ];

  const attempts = configs.flatMap((config) => [
    ...Array.from({ length: config.correct }, (_, idx) => ({
      answer: { selectedOption: 1 },
      answeredAt: new Date(now.getTime() - idx * 60 * 1000),
      dayOfWeek: now.getDay(),
      durationSeconds: 15,
      hourOfDay: config.hourOfDay,
      isCorrect: true,
      stepId,
      userId,
    })),
    ...Array.from({ length: config.incorrect }, (_, idx) => ({
      answer: { selectedOption: 0 },
      answeredAt: new Date(now.getTime() - (config.correct + idx) * 60 * 1000),
      dayOfWeek: now.getDay(),
      durationSeconds: 15,
      hourOfDay: config.hourOfDay,
      isCorrect: false,
      stepId,
      userId,
    })),
  ]);

  await prisma.stepAttempt.createMany({ data: attempts });
}

/**
 * Seed the minimal progress graph data used by account-level e2e tests.
 * This creates one published course path, enough attempts for score and best-
 * time widgets, and a partially completed activity so continue-learning UI has
 * a stable "next" target.
 */
export async function createE2EProgressData(userId: string): Promise<void> {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, SHORT_UUID_LENGTH);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-course-${uniqueId}`,
    title: `E2E Progress Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-chapter-${uniqueId}`,
    title: `E2E Progress Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-lesson-${uniqueId}`,
    title: `E2E Progress Lesson ${uniqueId}`,
  });

  const [completedActivity, _nextActivity] = await Promise.all([
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
      title: `E2E Completed Activity ${uniqueId}`,
    }),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
      title: `E2E Next Activity ${uniqueId}`,
    }),
  ]);

  const step = await stepFixture({
    activityId: completedActivity.id,
    content: { text: "E2E step content", title: "E2E Step" },
    isPublished: true,
    kind: "multipleChoice",
  });

  await userProgressFixture({
    currentEnergy: 75,
    totalBrainPower: 15_000n,
    userId,
  });

  await dailyProgressFixtureMany(buildDailyProgressInputs(today, userId));
  await createStepAttempts(step.id, userId, now);

  await Promise.all([
    prisma.activityProgress.create({
      data: {
        activityId: completedActivity.id,
        completedAt: new Date(now.getTime() - 60 * 1000),
        durationSeconds: COMPLETED_ACTIVITY_DURATION_SECONDS,
        startedAt: new Date(now.getTime() - COMPLETED_ACTIVITY_START_OFFSET_SECONDS * 1000),
        userId,
      },
    }),
    prisma.courseUser.create({
      data: { courseId: course.id, userId },
    }),
    prisma.course.update({
      data: { userCount: { increment: 1 } },
      where: { id: course.id },
    }),
  ]);
}
