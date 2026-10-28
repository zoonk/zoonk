import { type LearningEventKind, type Prisma } from "../../../../generated/prisma/client";
import { seededRandom } from "../../progress";
import { localTimeFields } from "../_utils/dates";
import { seedId } from "../_utils/seed-id";
import { SEED_TRANSACTION } from "../_utils/seed-transaction";
import { itemLessonKeys } from "./plan-graph";
import { type SeedLearner } from "./types";
import { type LearnerScope, planItemId } from "./write-goal";
import { studyMoment } from "./write-learning";
import { type FinishedBlock } from "./write-session";

const MS_PER_SECOND = 1000;

const ALL_RIGHT = 1;
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

export function getBrainPower(kind: LearningEventKind): number {
  return BRAIN_POWER[kind];
}

/** As the live flows label ledger rows (`lessonKind`), so seeded history counts the same way. */
const LEDGER_KINDS = {
  boss: "boss",
  capsule: "capsule",
  lesson: "library",
  practice: "practice",
  weekly: "weeklyChallenge",
} as const;

export type HistoryEvent = {
  kind: LearningEventKind;
  lessonKind: string | null;
  day: number;
  seconds: number;
  correct: number;
  incorrect: number;
  title: string;
  contentIds: Record<string, string>;
  endedAt?: Date;
};

type SeedHistoryEvent = NonNullable<SeedLearner["history"]["checkpoints"]>[number];

const SEED_HEX_DIGITS = 6;

function seedFor(learner: SeedLearner, day: number): number {
  const key = learner.historyKey ?? learner.key;
  return Number.parseInt(seedId(key).slice(0, SEED_HEX_DIGITS), 16) + day;
}

function lessonContentIds(lesson: {
  chapterId: string | null;
  id: string;
}): Record<string, string> {
  return { lessonId: lesson.id, ...(lesson.chapterId ? { chapterId: lesson.chapterId } : {}) };
}

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

function lessonEvent(scope: LearnerScope, { day, lesson }: { day: number; lesson: string }) {
  const found = scope.lookup.lesson(lesson);

  return {
    ...answered(3, scope.learner.history.accuracy),
    contentIds: lessonContentIds(found),
    day,
    kind: "lesson" as const,
    lessonKind: LEDGER_KINDS.lesson,
    seconds: found.minutes * SECONDS_PER_MINUTE,
    title: found.title,
  };
}

function lessonsDoneOn(scope: LearnerScope, day: number): HistoryEvent[] {
  const { course, plan } = scope.learner.goal;

  return plan.items.flatMap((item) =>
    item.day === day && item.status === "done"
      ? itemLessonKeys(course, item).map((lesson) => lessonEvent(scope, { day, lesson }))
      : [],
  );
}

function lastLessonBy(scope: LearnerScope, day: number) {
  const { course, plan } = scope.learner.goal;

  const lesson = plan.items
    .filter((item) => item.status === "done" && item.day !== undefined && item.day <= day)
    .toSorted((first, second) => (first.day ?? 0) - (second.day ?? 0))
    .flatMap((item) => itemLessonKeys(course, item))
    .at(-1);

  return lesson ? scope.lookup.lesson(lesson) : null;
}

function mockEvent(scope: LearnerScope, mock: SeedHistoryEvent): HistoryEvent {
  return {
    contentIds: planItemIds(scope, ["mock"], mock.day),
    correct: mock.correct,
    day: mock.day,
    incorrect: mock.total - mock.correct,
    kind: "mock",
    lessonKind: LEDGER_KINDS.weekly,
    seconds: mock.total * MOCK_MINUTES_PER_QUESTION * SECONDS_PER_MINUTE,
    title: mock.title,
  };
}

function checkpointEvent(scope: LearnerScope, checkpoint: SeedHistoryEvent): HistoryEvent {
  return {
    contentIds: planItemIds(scope, ["boss", "checkpoint"], checkpoint.day),
    correct: checkpoint.correct,
    day: checkpoint.day,
    incorrect: checkpoint.total - checkpoint.correct,
    kind: "checkpoint",
    lessonKind: LEDGER_KINDS.boss,
    seconds: checkpoint.total * SECONDS_PER_QUESTION,
    title: checkpoint.title,
  };
}

function studyDayEvents(scope: LearnerScope, day: number): HistoryEvent[] {
  const { learner } = scope;
  const { accuracy, checkpoints = [], minutesPerDay, mocks = [] } = learner.history;
  const mock = mocks.find((entry) => entry.day === day);

  if (mock) {
    return [mockEvent(scope, mock)];
  }

  const lessons = lessonsDoneOn(scope, day);
  const reviewed = lastLessonBy(scope, day - 1);
  const hasReview = Math.abs(day) % 2 === 0;
  const questions = 6 + Math.floor(seededRandom(seedFor(learner, day)) * 8);
  const minutes = Math.round(minutesPerDay * (0.7 + seededRandom(seedFor(learner, day) + 1) * 0.5));
  const reviewSeconds = hasReview ? 4 * SECONDS_PER_MINUTE : 0;
  const lessonSeconds = lessons.reduce((sum, event) => sum + event.seconds, 0);
  const title = lessons[0]?.title ?? reviewed?.title ?? "";

  const review: HistoryEvent[] = hasReview
    ? [
        {
          ...answered(3, accuracy),
          contentIds: reviewed ? { lessonId: reviewed.id } : {},
          day,
          kind: "review",
          lessonKind: LEDGER_KINDS.capsule,
          seconds: reviewSeconds,
          title: reviewed?.title ?? "",
        },
      ]
    : [];

  const practice: HistoryEvent = {
    ...answered(questions, accuracy),
    contentIds: {},
    day,
    kind: "questions",
    lessonKind: LEDGER_KINDS.practice,
    seconds: Math.max(
      minutes * SECONDS_PER_MINUTE - lessonSeconds - reviewSeconds,
      questions * SECONDS_PER_QUESTION,
    ),
    title,
  };

  return [
    ...review,
    ...lessons,
    practice,
    ...checkpoints
      .filter((checkpoint) => checkpoint.day === day)
      .map((checkpoint) => checkpointEvent(scope, checkpoint)),
  ];
}

function timeDay(scope: LearnerScope, day: number, events: readonly HistoryEvent[]) {
  const start = studyMoment(scope, day).getTime();

  return events.map((event, index) => {
    const seconds = events.slice(0, index + 1).reduce((sum, done) => sum + done.seconds, 0);
    return { ...event, endedAt: new Date(start + seconds * MS_PER_SECOND) };
  });
}

export type StudyDay = { day: number; events: HistoryEvent[] };

export function listStudyDays(scope: LearnerScope): StudyDay[] {
  const { learner } = scope;
  const { checkpoints = [], days, mocks = [], skipChance } = learner.history;

  const generated = Array.from({ length: days }, (_, index) => index - days).filter(
    (day) => seededRandom(seedFor(learner, day) + 2) >= skipChance,
  );

  const done = learner.goal.plan.items.flatMap((item) =>
    item.status === "done" && item.day !== undefined ? [item.day] : [],
  );

  const dated = [
    ...done,
    ...mocks.map((mock) => mock.day),
    ...checkpoints.map((entry) => entry.day),
  ];

  return [...new Set([...generated, ...dated])]
    .filter((day) => day < 0)
    .toSorted((first, second) => first - second)
    .map((day) => ({ day, events: timeDay(scope, day, studyDayEvents(scope, day)) }));
}

function finishedToday(scope: LearnerScope): HistoryEvent[] {
  return scope.learner.goal.plan.items.flatMap((item): HistoryEvent[] =>
    item.day === 0 && item.status === "done" && item.lesson
      ? [lessonEvent(scope, { day: 0, lesson: item.lesson })]
      : [],
  );
}

function listEvents(scope: LearnerScope): HistoryEvent[] {
  return [...listStudyDays(scope).flatMap((day) => day.events), ...finishedToday(scope)];
}

function toLedgerRow(
  scope: LearnerScope,
  goalId: string,
  event: HistoryEvent,
  order: number,
): Prisma.LearningEventCreateManyInput {
  const endedAt = event.endedAt ?? studyMoment(scope, event.day, order * 5);
  const brainPower = getBrainPower(event.kind);

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

function blockEvents(scope: LearnerScope, block: FinishedBlock): HistoryEvent[] {
  const { accuracy } = scope.learner.history;
  const { capsules, chapterId, drills, itemIds, title } = block.payload;

  const seconds = Math.round(
    (block.completedAt.getTime() - block.startedAt.getTime()) / MS_PER_SECOND,
  );

  const ended = { day: 0, endedAt: block.completedAt };

  if (block.kind === "review") {
    return capsules.map((capsule): HistoryEvent => ({
      ...answered(capsule.itemIds.length, ALL_RIGHT),
      ...ended,
      contentIds: capsule.lessonId ? { lessonId: capsule.lessonId } : {},
      kind: "review",
      lessonKind: LEDGER_KINDS.capsule,
      seconds: Math.round(seconds / Math.max(capsules.length, 1)),
      title: capsule.title,
    }));
  }

  if (block.kind === "learn" && block.lessonId) {
    return [
      {
        ...answered(3, accuracy),
        ...ended,
        contentIds: lessonContentIds({ chapterId, id: block.lessonId }),
        kind: "lesson",
        lessonKind: LEDGER_KINDS.lesson,
        seconds,
        title: title ?? "",
      },
    ];
  }

  const questions = itemIds.length + drills.reduce((sum, drill) => sum + drill.itemIds.length, 0);

  return [
    {
      ...answered(questions, ALL_RIGHT),
      ...ended,
      contentIds: {},
      kind: "questions",
      lessonKind: LEDGER_KINDS.practice,
      seconds,
      title: title ?? "",
    },
  ];
}

/** Seeded learners belong to the seed, so their history is rewritten on each run and ends today. */
export async function writeHistory(scope: LearnerScope, goalId: string): Promise<void> {
  const { learner, now, prisma, userId } = scope;

  const rows = listEvents(scope).map((event, order) =>
    toLedgerRow(scope, goalId, event, order % 3),
  );

  await prisma.$transaction(
    [
      prisma.learningEvent.deleteMany({ where: { userId } }),
      prisma.dailyProgress.deleteMany({ where: { userId } }),
      prisma.learningEvent.createMany({ data: rows }),
      prisma.dailyProgress.createMany({ data: toDailyTotals(scope, rows) }),
    ],
    SEED_TRANSACTION,
  );

  const endTimes = rows.flatMap((row) => (row.endedAt ? [new Date(row.endedAt).getTime()] : []));

  const progress = {
    currentEnergy: learner.history.energy,
    lastActiveAt: learner.session || endTimes.length === 0 ? now : new Date(Math.max(...endTimes)),
    totalBrainPower: BigInt(learner.brainPower),
  };

  await prisma.userProgress.upsert({
    create: { ...progress, userId },
    update: progress,
    where: { userId },
  });
}

/** Returns the Brain Power each block paid, in the session's order. */
export async function writeTodayHistory(
  scope: LearnerScope,
  { blocks, goalId }: { blocks: readonly FinishedBlock[]; goalId: string },
): Promise<number[]> {
  const rowsByBlock = blocks.map((block) =>
    blockEvents(scope, block).map((event) => toLedgerRow(scope, goalId, event, 0)),
  );

  const rows = rowsByBlock.flat();

  // Seeded just after midnight, a block that began before it counts for the day before, which the
  // history has totals for already: its totals add to theirs.
  const totals = toDailyTotals(scope, rows).map(({ date, userId, ...counts }) =>
    scope.prisma.dailyProgress.upsert({
      create: { ...counts, date, userId },
      update: {
        brainPowerEarned: { increment: counts.brainPowerEarned ?? 0 },
        correctAnswers: { increment: counts.correctAnswers ?? 0 },
        energyAtEnd: counts.energyAtEnd,
        incorrectAnswers: { increment: counts.incorrectAnswers ?? 0 },
        interactiveCompleted: { increment: counts.interactiveCompleted ?? 0 },
        lessonsCompleted: { increment: counts.lessonsCompleted ?? 0 },
        staticCompleted: { increment: counts.staticCompleted ?? 0 },
        timeSpentSeconds: { increment: counts.timeSpentSeconds ?? 0 },
      },
      where: { userDate: { date, userId } },
    }),
  );

  if (rows.length > 0) {
    await scope.prisma.$transaction(
      [scope.prisma.learningEvent.createMany({ data: rows }), ...totals],
      SEED_TRANSACTION,
    );
  }

  return rowsByBlock.map((blockRows) =>
    blockRows.reduce((sum, row) => sum + (row.brainPower ?? 0), 0),
  );
}
