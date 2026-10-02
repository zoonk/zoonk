import { type LearningEventKind, type Prisma } from "../../../../generated/prisma/client";
import { seededRandom } from "../../progress";
import { localTimeFields } from "../_utils/dates";
import { seedId } from "../_utils/seed-id";
import { type SeedLearner } from "./types";
import { type LearnerScope, planItemId } from "./write-goal";
import { studyMoment } from "./write-learning";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_QUESTION = 40;
const MOCK_MINUTES_PER_QUESTION = 3;
const SCREENS_PER_LESSON = 5;

const BRAIN_POWER: Record<LearningEventKind, number> = {
  checkpoint: 120,
  conversation: 50,
  explanation: 30,
  lesson: 60,
  mock: 200,
  questions: 30,
  review: 25,
  session: 0,
};

/**
 * How the live flows label their ledger rows (`lessonKind`), so seeded history counts the same
 * way: Library lessons, capsules opened (Retro glasses), practice blocks, bosses won (Star
 * glasses) and weekly Big Challenges, which are mock exams for exam goals.
 */
const LEDGER_KINDS = {
  boss: "boss",
  capsule: "capsule",
  lesson: "library",
  practice: "practice",
  weekly: "weeklyChallenge",
} as const;

type HistoryEvent = {
  kind: LearningEventKind;
  lessonKind: string | null;
  day: number;
  seconds: number;
  correct: number;
  incorrect: number;
  title: string;
  contentIds: Record<string, string>;
};

const SEED_HEX_DIGITS = 6;

/** A stable number per learner and day, so each learner's calendar has its own rhythm. */
function seedFor(learner: SeedLearner, day: number): number {
  return Number.parseInt(seedId(learner.key).slice(0, SEED_HEX_DIGITS), 16) + day;
}

function studiedLessons(scope: LearnerScope) {
  const items = scope.learner.goal.plan.items.filter((item) => item.lesson);
  const done = items.filter((item) => item.status === "done");

  return (done.length > 0 ? done : items).flatMap((item) =>
    item.lesson ? [scope.lookup.lesson(item.lesson)] : [],
  );
}

/** Plain content ids for a lesson row, as the player writes them, so the row outlives the content. */
function lessonContentIds(lesson: {
  chapterId: string | null;
  id: string;
}): Record<string, string> {
  return { lessonId: lesson.id, ...(lesson.chapterId ? { chapterId: lesson.chapterId } : {}) };
}

/** A capsule row names the lesson whose ideas it reviewed, when there is one. */
function capsuleContentIds(
  scope: LearnerScope,
  lessonKey: string | undefined,
): Record<string, string> {
  return lessonKey ? { lessonId: scope.lookup.lesson(lessonKey).id } : {};
}

/** The plan item a mock or boss on `day` belongs to, so its result shows on the plan. */
function planItemIds(
  scope: LearnerScope,
  kinds: readonly string[],
  day: number,
): Record<string, string> {
  const { goal } = scope.learner;

  const position = goal.plan.items.findIndex(
    (item) => kinds.includes(item.kind) && item.day === day,
  );

  return position === -1 ? {} : { planItemId: planItemId(scope.learner, goal, position) };
}

function answered(questions: number, accuracy: number) {
  const correct = Math.round(questions * accuracy);
  return { correct, incorrect: questions - correct };
}

/** A past day of study: a lesson, questions on it and, every other day, a review. */
function pastDay(scope: LearnerScope, day: number): HistoryEvent[] {
  const { learner } = scope;
  const { accuracy, minutesPerDay } = learner.history;
  const lessons = studiedLessons(scope);
  const lesson = lessons[Math.abs(day) % Math.max(lessons.length, 1)];
  const questions = 6 + Math.floor(seededRandom(seedFor(learner, day)) * 8);
  const minutes = Math.round(minutesPerDay * (0.7 + seededRandom(seedFor(learner, day) + 1) * 0.5));
  const hasReview = Math.abs(day) % 2 === 0;
  const lessonSeconds = lesson ? lesson.minutes * SECONDS_PER_MINUTE : 0;
  const reviewSeconds = hasReview ? 4 * SECONDS_PER_MINUTE : 0;

  const events: HistoryEvent[] = [
    {
      ...answered(questions, accuracy),
      contentIds: {},
      day,
      kind: "questions",
      lessonKind: LEDGER_KINDS.practice,
      seconds: Math.max(
        minutes * SECONDS_PER_MINUTE - lessonSeconds - reviewSeconds,
        questions * SECONDS_PER_QUESTION,
      ),
      title: lesson?.title ?? "",
    },
  ];

  if (lesson) {
    events.push({
      ...answered(3, accuracy),
      contentIds: lessonContentIds(lesson),
      day,
      kind: "lesson",
      lessonKind: LEDGER_KINDS.lesson,
      seconds: lessonSeconds,
      title: lesson.title,
    });
  }

  if (hasReview) {
    events.push({
      ...answered(3, accuracy),
      contentIds: lesson ? { lessonId: lesson.id } : {},
      day,
      kind: "review",
      lessonKind: LEDGER_KINDS.capsule,
      seconds: reviewSeconds,
      title: lesson?.title ?? "",
    });
  }

  return events;
}

function listEvents(scope: LearnerScope): HistoryEvent[] {
  const { learner } = scope;
  const { checkpoints = [], days, mocks = [], skipChance } = learner.history;

  const studyDays = Array.from({ length: days }, (_, index) => index - days).filter(
    (day) => seededRandom(seedFor(learner, day) + 2) >= skipChance,
  );

  return [
    ...studyDays.flatMap((day) => pastDay(scope, day)),
    ...mocks.map((mock) => ({
      contentIds: planItemIds(scope, ["mock"], mock.day),
      correct: mock.correct,
      day: mock.day,
      incorrect: mock.total - mock.correct,
      kind: "mock" as const,
      lessonKind: LEDGER_KINDS.weekly,
      seconds: mock.total * MOCK_MINUTES_PER_QUESTION * SECONDS_PER_MINUTE,
      title: mock.title,
    })),
    ...checkpoints.map((checkpoint) => ({
      contentIds: planItemIds(scope, ["boss", "checkpoint"], checkpoint.day),
      correct: checkpoint.correct,
      day: checkpoint.day,
      incorrect: checkpoint.total - checkpoint.correct,
      kind: "checkpoint" as const,
      lessonKind: LEDGER_KINDS.boss,
      seconds: checkpoint.total * SECONDS_PER_QUESTION,
      title: checkpoint.title,
    })),
  ];
}

function toLedgerRow(
  scope: LearnerScope,
  goalId: string,
  event: HistoryEvent,
  order: number,
): Prisma.LearningEventCreateManyInput {
  const endedAt = studyMoment(scope, event.day, order * 5);
  const brainPower = BRAIN_POWER[event.kind];

  return {
    brainPower,
    contentIds: event.contentIds,
    correctAnswers: event.correct,
    endedAt,
    energyDelta: event.correct > event.incorrect ? 2 : 1,
    goalId,
    incorrectAnswers: event.incorrect,
    kind: event.kind,
    lessonKind: event.lessonKind,
    mode: scope.learner.mode,
    seconds: event.seconds,
    startedAt: new Date(endedAt.getTime() - event.seconds * 1000),
    titleSnapshot: event.title || null,
    userId: scope.userId,
    ...localTimeFields(endedAt, scope.learner.timeZone),
  };
}

function dayKeyOf(row: Prisma.LearningEventCreateManyInput): string {
  return row.localDate instanceof Date ? row.localDate.toISOString() : row.localDate;
}

/** Energy climbs toward today's value over the history, since the learner kept studying. */
const ENERGY_STEP = 0.5;
const MIN_ENERGY = 20;
const MAX_ENERGY = 100;

function toDailyTotals(
  scope: LearnerScope,
  rows: Prisma.LearningEventCreateManyInput[],
): Prisma.DailyProgressCreateManyInput[] {
  const days = [...new Set(rows.map((row) => dayKeyOf(row)))].toSorted();

  return days.map((dayKey, index) => {
    const dayRows = rows.filter((row) => dayKeyOf(row) === dayKey);
    const date = new Date(dayKey);

    const sum = (pick: (row: Prisma.LearningEventCreateManyInput) => number | undefined) =>
      dayRows.reduce((total, row) => total + (pick(row) ?? 0), 0);

    const lessons = dayRows.filter((row) => row.kind === "lesson").length;

    return {
      brainPowerEarned: sum((row) => row.brainPower),
      correctAnswers: sum((row) => row.correctAnswers),
      date,
      dayOfWeek: date.getUTCDay(),
      energyAtEnd: Math.max(
        MIN_ENERGY,
        Math.min(
          MAX_ENERGY,
          scope.learner.history.energy - (days.length - 1 - index) * ENERGY_STEP,
        ),
      ),
      incorrectAnswers: sum((row) => row.incorrectAnswers),
      interactiveCompleted: sum((row) => (row.correctAnswers ?? 0) + (row.incorrectAnswers ?? 0)),
      lessonsCompleted: lessons,
      staticCompleted: lessons * SCREENS_PER_LESSON,
      timeSpentSeconds: sum((row) => row.seconds),
      userId: scope.userId,
    };
  });
}

/** Today's finished session blocks, as the ledger records them when each one ends. */
function todayEvents(scope: LearnerScope): HistoryEvent[] {
  const { learner, lookup } = scope;
  const { accuracy } = learner.history;

  return learner.session.blocks
    .filter((block) => block.status === "completed")
    .flatMap((block): HistoryEvent[] => {
      const seconds = block.minutes * SECONDS_PER_MINUTE;

      if (block.kind === "review") {
        const capsules = block.capsules ?? [];

        return capsules.map((capsule) => ({
          ...answered(capsule.items.length, accuracy),
          contentIds: capsuleContentIds(scope, capsule.lesson),
          day: 0,
          kind: "review",
          lessonKind: LEDGER_KINDS.capsule,
          seconds: Math.round(seconds / Math.max(capsules.length, 1)),
          title: capsule.title,
        }));
      }

      if (block.kind === "learn" && block.lesson) {
        const lesson = lookup.lesson(block.lesson);

        return [
          {
            ...answered(3, accuracy),
            contentIds: lessonContentIds(lesson),
            day: 0,
            kind: "lesson",
            lessonKind: LEDGER_KINDS.lesson,
            seconds,
            title: lesson.title,
          },
        ];
      }

      return [
        {
          ...answered(block.items?.length ?? 3, accuracy),
          contentIds: {},
          day: 0,
          kind: "questions",
          lessonKind: LEDGER_KINDS.practice,
          seconds,
          title: block.title ?? "",
        },
      ];
    });
}

/**
 * The learner's history over the past weeks, for Progress, the activity calendar and stats: one
 * ledger row per lesson, question block, review, mock or checkpoint, the daily totals they add up
 * to, and today's rows for the session blocks already done. Seeded learners belong to the seed,
 * so their history is rewritten on each run and always ends today.
 */
export async function writeHistory(scope: LearnerScope, goalId: string): Promise<void> {
  const { learner, now, prisma, userId } = scope;

  const rows = [...listEvents(scope), ...todayEvents(scope)].map((event, order) =>
    toLedgerRow(scope, goalId, event, order % 3),
  );

  await prisma.$transaction([
    prisma.learningEvent.deleteMany({ where: { userId } }),
    prisma.dailyProgress.deleteMany({ where: { userId } }),
    prisma.learningEvent.createMany({ data: rows }),
    prisma.dailyProgress.createMany({ data: toDailyTotals(scope, rows) }),
  ]);

  const progress = {
    currentEnergy: learner.history.energy,
    lastActiveAt: now,
    totalBrainPower: BigInt(learner.brainPower),
  };

  await prisma.userProgress.upsert({
    create: { ...progress, userId },
    update: progress,
    where: { userId },
  });
}
