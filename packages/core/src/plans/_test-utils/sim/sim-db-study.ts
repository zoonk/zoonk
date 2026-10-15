import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { runDeferredWork } from "../../../_test-utils/deferred-work";
import { readBlockPayload } from "../../../sessions/block-payload";
import { finishStudyBlock } from "../../../sessions/finish-study-block";
import { startStudyBlock } from "../../../sessions/start-study-block";
import { stopStudySession } from "../../../sessions/stop-study-session";
import { upsertDailyProgress } from "../../../stats/daily-progress";
import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { type RuleAnswer } from "../rules/rule-context";
import { playWrittenLesson } from "./sim-db-lessons";
import { takeMock } from "./sim-db-mock";
import { playQuestionBlock } from "./sim-db-questions";
import { setSimToday } from "./sim-db-reads";
import { type DbRunner, recordDb, skillAtDb } from "./sim-db-runner";
import { openTodayDb } from "./sim-db-today";
import { type SimLifeStep } from "./sim-life-plan";

/** The database tier's study days: Today's session played block by block, as the player does. */

const SECONDS_PER_MINUTE = 60;

/**
 * The day's study as completing a lesson or a session's block writes it (`upsertDailyProgress`):
 * a fresh start counts the days away from it, so a learner who studied yesterday never comes back
 * to a welcome back.
 */
async function recordStudyDay(runner: DbRunner, seconds: number) {
  await upsertDailyProgress(prisma, {
    clampedEnergy: 0,
    date: runner.today,
    durationSeconds: seconds,
    field: "interactiveCompleted",
    lessonsCompleted: 0,
    score: { brainPower: 0, correctCount: 0, incorrectCount: 0 },
    userId: runner.goal.userId,
  });
}

/** A duel won as finishing it records it: its block completed, its plan item done, the day studied. */
async function winBoss(
  runner: DbRunner,
  block: { estimatedMinutes: number; id: string; planItemId: string | null },
) {
  await prisma.studySessionBlock.update({
    data: { completedAt: new Date(), status: "completed" },
    where: { id: block.id },
  });

  if (block.planItemId) {
    await prisma.planItem.update({
      data: { completedAt: new Date(), status: "done" },
      where: { id: block.planItemId },
    });
  }

  await recordStudyDay(runner, block.estimatedMinutes * SECONDS_PER_MINUTE);
}

/** Plays a learn block as the player does: the learner takes `speed` times the lesson's estimate. */
async function playLesson(
  runner: DbRunner,
  { blockId, lessonId, sessionId }: { blockId: string; lessonId: string; sessionId: string },
) {
  const input = { timeZone: "UTC" };

  const lesson = await prisma.lesson.findUniqueOrThrow({
    select: { estimatedMinutes: true },
    where: { id: lessonId },
  });

  const seconds = Math.round(lesson.estimatedMinutes * SECONDS_PER_MINUTE * runner.life.speed);

  await startStudyBlock({ blockId, input, sessionId });

  await learningEventFixture({
    brainPower: 10,
    contentIds: { lessonId },
    endedAt: new Date(),
    seconds,
    userId: runner.goal.userId,
  });

  await finishStudyBlock({ blockId, input, sessionId });
  await recordStudyDay(runner, seconds);
}

/** Whether the learner finished a plan item today: progress the plan wasn't planned with yet. */
async function hasFinishedToday(runner: DbRunner): Promise<boolean> {
  const count = await prisma.planItem.count({
    where: { completedAt: { gte: runner.today }, planId: runner.plan.id },
  });

  return count > 0;
}

/** Whether answers tested lessons out: a `testedOut` change the run hasn't recorded yet. */
async function hasNewTestOut(runner: DbRunner): Promise<boolean> {
  const count = await prisma.planChange.count({
    where: { id: { notIn: [...runner.seen.keys()] }, kind: "testedOut", planId: runner.plan.id },
  });

  return count > 0;
}

/**
 * A study day when the library has questions: the learner plays the first `finish` share of the
 * session's blocks in order, lessons through the lesson player and questions, answered wrong on
 * the day's missed skills. A question block whose placement answers tested lessons out is a
 * test-out step of its own to the checks, recorded as it happens. Returns the session's other
 * answers.
 */
async function playSession(
  runner: DbRunner,
  {
    index,
    sessionId,
    step,
  }: { index: number; sessionId: string; step: Extract<SimLifeStep, { kind: "study" }> },
): Promise<RuleAnswer[]> {
  const blocks = await prisma.studySessionBlock.findMany({
    orderBy: { position: "asc" },
    where: { sessionId },
  });

  const playing = blocks.slice(0, Math.round(blocks.length * step.finish));
  const misses = new Set(step.misses.map((skill) => skillAtDb(runner, skill)));

  return playing.reduce<Promise<RuleAnswer[]>>(async (previous, block) => {
    const answers = await previous;

    if (block.kind === "learn" && block.lessonId) {
      const played = await playWrittenLesson(runner, { block, misses, sessionId });
      runner.answers.push(...played);
      return [...answers, ...played];
    }

    // An exam's weekly mock is taken on the mock screen, in real conditions.
    if (readBlockPayload(block).checkpoint?.mock) {
      return takeMock(runner, { answers, blockId: block.id, index, misses });
    }

    const asked = await playQuestionBlock({ at: runner.today, block, misses, sessionId });

    runner.answers.push(...asked);

    if (await hasNewTestOut(runner)) {
      await recordDb(runner, {
        event: { answers: asked, kind: "testOut" },
        label: "testOut",
        step: index,
      });

      return answers;
    }

    return [...answers, ...asked];
  }, Promise.resolve([]));
}

async function runStudyWithQuestions(
  runner: DbRunner,
  step: Extract<SimLifeStep, { kind: "study" }>,
  index: number,
) {
  const session = await openTodayDb(runner, index);
  const answers = session ? await playSession(runner, { index, sessionId: session.id, step }) : [];

  if (session && step.finish > 0) {
    const finish = runDeferredWork();
    await stopStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });
    await finish();
  }

  runner.progressed ||= await hasFinishedToday(runner);
  await recordDb(runner, { event: { answers, kind: "session" }, label: "session", step: index });

  runner.today = addDays(runner.today, 1);
  setSimToday(toIsoDate(runner.today));
}

export async function runStudyDb(
  runner: DbRunner,
  step: Extract<SimLifeStep, { kind: "study" }>,
  index: number,
) {
  if (runner.questions) {
    return runStudyWithQuestions(runner, step, index);
  }

  const session = await openTodayDb(runner, index);
  const finishDeferredWork = runDeferredWork();
  const sessionId = session?.id ?? "";

  const learn =
    session?.blocks.flatMap((block) =>
      block.kind === "learn" && block.lessonId
        ? [{ blockId: block.id, lessonId: block.lessonId }]
        : [],
    ) ?? [];

  const finishing = learn.slice(0, Math.round(learn.length * step.finish));
  const duels = session?.blocks.filter((block) => block.kind === "checkpoint") ?? [];
  const wins = learn.length === 0 && step.finish > 0 ? duels : [];

  // The fixtures have no questions: each of the day's duels is won as finishing it records it, in
  // the session's order.
  await wins.reduce(
    (previous, block) => previous.then(() => winBoss(runner, block)),
    Promise.resolve(),
  );

  // A session's blocks are played in order.
  await finishing.reduce(
    (previous, block) => previous.then(() => playLesson(runner, { ...block, sessionId })),
    Promise.resolve(),
  );

  // A session whose blocks are all done completed as the last one finished (the plan re-planned at
  // the learner's pace); one stopped halfway gets its weekly rebalance instead.
  if (session && (finishing.length > 0 || wins.length > 0)) {
    await stopStudySession({ input: { timeZone: "UTC" }, sessionId });
  }

  /** Session-end planning belongs to this day, before its snapshot or the next learner action. */
  await finishDeferredWork();
  runner.progressed ||= finishing.length > 0 || wins.length > 0;
  await recordDb(runner, { event: { kind: "session" }, label: "session", step: index });

  runner.today = addDays(runner.today, 1);
  setSimToday(toIsoDate(runner.today));
}
