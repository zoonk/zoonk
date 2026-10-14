import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import { readBlockPayload } from "../sessions/block-payload";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

const MONDAY = "2020-09-28";
const TUESDAY = "2020-09-29";
const WEDNESDAY = "2020-09-30";

async function readItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

async function setup(timeZone: string) {
  const [user, course, library] = await Promise.all([
    userFixture(),
    courseFixture({ isPublished: true, outlineStatus: "completed", visibility: "public" }),
    planLibraryFixture({
      phases: ["Basics", "Application"],
      skills: [
        { area: "Math", lessons: 1 },
        { area: "Math", lessons: 1, phase: 1 },
      ],
    }),
  ]);

  await Promise.all([
    prisma.lesson.updateMany({
      data: { contentStatus: "completed", estimatedMinutes: 5, specStatus: "completed" },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    }),
    ...library.lessons.map((lesson) => libraryStepFixture({ lessonId: lesson.id })),
    ...library.chapters.map((chapter, position) =>
      courseChapterFixture({ area: "Math", chapterId: chapter.id, courseId: course.id, position }),
    ),
    ...library.skills.flatMap((skill) =>
      Array.from({ length: 10 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 10,
    details: {
      courseStart: { chapterId: library.chapters[0]?.id ?? null },
      placementDeclined: true,
    },
    kind: "learn",
    primaryCourseId: course.id,
    settings: { startDate: MONDAY, weekdayMinutes: [0, 10, 10, 10, 10, 10, 0] },
    timezone: timeZone,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  // Only the existing auth/cache framework harness is mocked; all learning and plan rows persist.
  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  const original = await readItems(plan.id);
  const lessons = original.filter((item) => item.kind === "lesson");
  const bosses = original.filter((item) => item.kind === "boss");
  expect(lessons).toHaveLength(2);
  expect(bosses).toHaveLength(2);

  expect(lessons.map((item) => item.scheduledFor)).toStrictEqual([
    new Date(MONDAY),
    new Date(WEDNESDAY),
  ]);

  return { bosses, goal, lessons, plan, timeZone, user };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

async function completeOne({
  completedAt,
  fixture,
  item,
}: {
  completedAt: Date;
  fixture: Fixture;
  item: Fixture["lessons"][number];
}) {
  if (!item.lessonId || Number.isNaN(completedAt.getTime())) {
    throw new Error("Expected the actual build's lessons and their completion instants");
  }

  vi.setSystemTime(new Date(completedAt.getTime() - 5 * 60_000));

  const started = await startLibraryLesson({
    input: { timeZone: fixture.timeZone },
    lessonId: item.lessonId,
  });

  if (started.status !== "started") {
    throw new Error(`Expected a real lesson start: ${started.status}`);
  }

  vi.setSystemTime(completedAt);

  await expect(
    completeLibraryLesson({
      input: { runId: started.run.runId, timeZone: fixture.timeZone },
      lessonId: item.lessonId,
    }),
  ).resolves.toMatchObject({ status: "completed" });

  await expect(
    prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
  ).resolves.toMatchObject({
    completedAt,
    lessonId: item.lessonId,
    scheduledFor: item.scheduledFor,
    status: "done",
  });

  return started.run.runId;
}

async function completeAhead(fixture: Fixture, completionTimes: readonly string[]) {
  // The two real runs must finish in order because they share this test's frozen clock.
  const runIds = await fixture.lessons.reduce<Promise<string[]>>(async (previous, item, index) => {
    const completed = await previous;

    const runId = await completeOne({
      completedAt: new Date(completionTimes[index] ?? ""),
      fixture,
      item,
    });

    return [...completed, runId];
  }, Promise.resolve([]));

  await expect(
    prisma.learningEvent.findMany({ orderBy: { endedAt: "asc" }, where: { id: { in: runIds } } }),
  ).resolves.toMatchObject(
    completionTimes.map((instant, index) => ({
      contentIds: { lessonId: fixture.lessons[index]?.lessonId },
      endedAt: new Date(instant),
      seconds: 300,
      userId: fixture.user.id,
    })),
  );

  await expect(
    prisma.dailyProgress.findUniqueOrThrow({
      where: { userDate: { date: new Date(MONDAY), userId: fixture.user.id } },
    }),
  ).resolves.toMatchObject({ lessonsCompleted: 2, timeSpentSeconds: 600 });

  const items = await readItems(fixture.plan.id);

  return items.filter((item) => item.kind === "lesson");
}

async function readDay(fixture: Fixture) {
  await refreshGoalPlan({ goalId: fixture.goal.id, pace: "saved" });
  const view = await getGoalPlan(fixture.goal.id);
  expect(view.status).toBe("ready");

  const card = await getChallenge({
    input: { timeZone: fixture.timeZone },
    planItemId: fixture.bosses[1]?.id ?? "",
  });

  const today = await getTodayView({ goalId: fixture.goal.id, timeZone: fixture.timeZone });

  if (today.status !== "ready") {
    throw new Error(`Expected the actual day: ${today.status}`);
  }

  const session = await prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: today.today.session.id },
  });

  const saved = await prisma.plan.findUniqueOrThrow({
    select: {
      goal: { select: { dailyMinutes: true, targetDate: true, timezone: true } },
      settings: true,
    },
    where: { id: fixture.plan.id },
  });

  const settings = parsePlanSettings(saved.settings);

  return {
    card,
    input: { goal: saved.goal, pace: settings.pace, weekdayMinutes: settings.weekdayMinutes },
    items: await readItems(fixture.plan.id),
    session,
    today: today.today,
    view,
  };
}

function teachingFacts(items: Awaited<ReturnType<typeof readItems>>) {
  return items
    .filter((item) => item.kind === "lesson")
    .map(({ completedAt, id, lessonId, scheduledFor, status }) => ({
      completedAt,
      id,
      lessonId,
      scheduledFor,
      status,
    }));
}

async function finishFirstBoss(fixture: Fixture) {
  const started = await startChallenge({
    input: { timeZone: fixture.timeZone },
    planItemId: fixture.bosses[0]?.id ?? "",
  });

  if (started.status !== "ready") {
    throw new Error(`Expected the due first boss to start: ${started.status}`);
  }

  const { blockId, sessionId } = started.destination;
  await answerBlockInOrder({ blockId, optionIndex: 0, sessionId });

  await expect(
    finishStudyBlock({ blockId, input: { timeZone: fixture.timeZone }, sessionId }),
  ).resolves.toMatchObject({ status: "ready" });
}

async function expectTuesdayStable({
  fixture,
  finished,
  nextMorning,
}: {
  fixture: Fixture;
  finished: Awaited<ReturnType<typeof completeAhead>>;
  nextMorning: string;
}) {
  // A learner replan releases the safe previously shown Thursday end. Automatic refresh alone
  // intentionally keeps that end; no saved date is edited to establish the new Tuesday promise.
  await expect(
    changeGoalPlan({
      goalId: fixture.goal.id,
      input: {
        operations: [{ kind: "setWeekdayMinutes", minutes: 30, weekdays: [1, 2, 3, 4, 5] }],
        timeZone: fixture.timeZone,
      },
    }),
  ).resolves.toMatchObject({ status: "applied" });

  const afterChange = await readItems(fixture.plan.id);

  expect(afterChange.filter((item) => item.kind === "lesson")).toMatchObject(
    finished.map(({ completedAt, id, lessonId, status }) => ({
      completedAt,
      id,
      lessonId,
      status,
    })),
  );

  const secondBossId = fixture.bosses[1]?.id ?? "";

  expect(afterChange.find((item) => item.id === secondBossId)?.scheduledFor).toStrictEqual(
    new Date(TUESDAY),
  );

  const monday = await readDay(fixture);
  expect(teachingFacts(monday.items)).toStrictEqual(teachingFacts(afterChange));
  expect(monday.input.weekdayMinutes).toStrictEqual([0, 30, 30, 30, 30, 30, 0]);

  expect(monday.items.find((item) => item.id === secondBossId)?.scheduledFor).toStrictEqual(
    new Date(TUESDAY),
  );

  expect(monday.card).toMatchObject({
    challenge: { date: TUESDAY, minutes: 15, questions: 10, status: "upcoming" },
    status: "ready",
  });

  expect(monday.view).toMatchObject({
    plan: {
      phases: [
        { checkpoint: { date: TUESDAY, planItemId: fixture.bosses[0]?.id, when: "date" } },
        { checkpoint: { date: TUESDAY, planItemId: secondBossId, when: "date" } },
      ],
    },
    status: "ready",
  });

  expect(monday.session.localDate).toStrictEqual(new Date(MONDAY));

  expect(
    monday.session.blocks.some((block) => readBlockPayload(block).planItemId === secondBossId),
  ).toBe(false);

  await expect(
    startChallenge({ input: { timeZone: fixture.timeZone }, planItemId: secondBossId }),
  ).resolves.toMatchObject({ status: "notToday" });

  vi.setSystemTime(new Date(nextMorning));
  const tuesday = await readDay(fixture);
  expect(teachingFacts(tuesday.items)).toStrictEqual(teachingFacts(afterChange));
  expect(tuesday.input).toStrictEqual(monday.input);

  expect
    .soft(tuesday.items.find((item) => item.id === secondBossId)?.scheduledFor)
    .toStrictEqual(new Date(TUESDAY));

  expect
    .soft(tuesday.card)
    .toMatchObject({
      challenge: { date: TUESDAY, minutes: 15, questions: 10, status: "ready" },
      status: "ready",
    });

  expect
    .soft(tuesday.view)
    .toMatchObject({
      plan: {
        phases: [
          { checkpoint: { date: TUESDAY, planItemId: fixture.bosses[0]?.id, when: "nextSession" } },
          { checkpoint: { date: TUESDAY, planItemId: secondBossId, when: "nextSession" } },
        ],
      },
      status: "ready",
    });

  expect(tuesday.session.localDate).toStrictEqual(new Date(TUESDAY));

  expect
    .soft(tuesday.session.blocks.map((block) => readBlockPayload(block).planItemId))
    .toContain(secondBossId);

  expect(tuesday.today.session.minutes.dailyGoal).toBe(30);
  expect(tuesday.session.plannedMinutes).toBe(30);

  expect(
    tuesday.session.blocks
      .filter((block) => block.kind === "checkpoint")
      .map((block) => ({
        minutes: block.estimatedMinutes,
        planItemId: readBlockPayload(block).planItemId,
      })),
  ).toStrictEqual(fixture.bosses.map((boss) => ({ minutes: 15, planItemId: boss.id })));

  await finishFirstBoss(fixture);

  await expect
    .soft(startChallenge({ input: { timeZone: fixture.timeZone }, planItemId: secondBossId }))
    .resolves.toMatchObject({ destination: { kind: "checkpoint" }, status: "ready" });
}

describe("a boss's actual completed teaching day stays fixed as today advances", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("keeps Tuesday due when a genuinely future Wednesday lesson was completed Monday", async () => {
    const fixture = await setup("UTC");

    const finished = await completeAhead(fixture, ["2020-09-28T12:05:00Z", "2020-09-28T12:10:00Z"]);

    expect(finished[1]).toMatchObject({
      completedAt: new Date("2020-09-28T12:10:00Z"),
      scheduledFor: new Date(WEDNESDAY),
      status: "done",
    });

    await expectTuesdayStable({ finished, fixture, nextMorning: "2020-09-29T12:00:00Z" });
  });

  it("uses Monday's Brazil completion day even when the real completion instant is UTC Tuesday", async () => {
    const fixture = await setup("America/Sao_Paulo");

    const finished = await completeAhead(fixture, ["2020-09-29T02:49:00Z", "2020-09-29T02:59:00Z"]);

    expect(finished[1]).toMatchObject({
      completedAt: new Date("2020-09-29T02:59:00Z"),
      scheduledFor: new Date(WEDNESDAY),
      status: "done",
    });

    await expectTuesdayStable({ finished, fixture, nextMorning: "2020-09-29T03:01:00Z" });
  });
});
