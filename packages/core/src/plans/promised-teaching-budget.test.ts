import { type PlanItem, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { boundaries } from "../_test-utils/test-boundaries";
import { getChallenge } from "../checkpoints/get-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { getGoalDayMinutes } from "../sessions/_utils/day-minutes";
import { completeLessonPlanItems } from "../sessions/_utils/plan-items";
import { readBlockPayload } from "../sessions/block-payload";
import { upsertDailyProgress } from "../stats/daily-progress";
import { getChapterView } from "../view-models/chapter/get-chapter-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { findChapterInProgress } from "./planner/chapter-in-progress";
import { toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph, type PlanSettings, parsePlanSettings } from "./planner/plan-state";

const START = "2026-10-10";
const CHANGE_DAY = "2026-10-12";
const PROMISED_DAY = "2026-10-15";
const DAILY_MINUTES = 25;
const LESSON_MINUTES = 4;

function on(date: string) {
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));
}

async function skillChapter({
  area,
  courseId,
  index,
  phase,
}: {
  area: string;
  courseId: string;
  index: number;
  phase: number;
}) {
  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({ title: `${area} ${phase} ${courseId}` }),
    skillFixture({ name: `${area} ${phase} ${courseId}` }),
  ]);

  await Promise.all([
    courseChapterFixture({ area, chapterId: chapter.id, courseId, position: index * 2 + phase }),
    chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    ...Array.from({ length: 10 }, () =>
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ),
    ...Array.from({ length: 4 + index }, async (_, position) => {
      const lesson = await libraryLessonFixture({
        contentStatus: "completed",
        estimatedMinutes: LESSON_MINUTES,
        homeChapterId: chapter.id,
        title: `${area} ${phase}.${position} ${courseId}`,
      });

      await Promise.all([
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      ]);
    }),
  ]);

  return {
    chapterId: chapter.id,
    skill: {
      area,
      courseIds: [courseId],
      lessons: 4 + index,
      name: skill.name,
      phase,
      skillId: skill.id,
      weight: 2 + index,
    },
  };
}

/** The pure chapter-in-progress cycle, with isolated real Library identities and question bank. */
async function setup() {
  const [user, course, blueprint] = await Promise.all([
    userFixture(),
    courseFixture(),
    examBlueprintFixture({
      structure: examStructureSchema.parse({
        formats: [],
        mock: {
          citations: [],
          order: null,
          scoring: { description: "One point per correct answer", method: "raw" },
          sections: [{ day: 1, minutes: 360, name: "Exam", questions: 120 }],
          timeLimitMinutes: 360,
          totalQuestions: 120,
        },
        rules: [],
        subjects: [],
      }),
    }),
  ]);

  const chapters = await Promise.all(
    ["Natureza", "Humanas", "Matemática", "Linguagens"].flatMap((area, index) =>
      [0, 1].map((phase) => skillChapter({ area, courseId: course.id, index, phase })),
    ),
  );

  const activeChapterId = chapters.find(
    ({ skill }) => skill.area === "Linguagens" && skill.phase === 0,
  )?.chapterId;

  if (!activeChapterId) {
    throw new Error("Expected the real Linguagens chapter");
  }

  const graph: PlanGraph = {
    phases: [
      { milestone: null, name: "Base" },
      { milestone: null, name: "Aprofundamento" },
    ],
    skills: chapters.map(({ skill }) => skill),
  };

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(START),
    dailyMinutes: DAILY_MINUTES,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    primaryCourseId: course.id,
    settings: { pace: { factor: 1, source: "typical" }, startDate: START },
    targetDate: new Date("2026-11-16"),
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph })).resolves.toMatchObject({
    status: "created",
  });

  return { activeChapterId, goal, graph, plan, user };
}

async function readSaved(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return { ...plan, settings: parsePlanSettings(plan.settings) };
}

function pastDonations(settings: PlanSettings) {
  return settings.mockFunding
    .flatMap((entry) =>
      entry.contributions.filter((contribution) => contribution.date < CHANGE_DAY),
    )
    .toSorted((first, second) => first.date.localeCompare(second.date));
}

/** Real ledger and completion projections keep this an active learner, without invented plan items. */
async function finishBefore({
  activeChapterId,
  date,
  finishedOn = new Map(),
  items,
  userId,
}: {
  activeChapterId: string;
  date: string;
  finishedOn?: ReadonlyMap<string, Date>;
  items: PlanItem[];
  userId: string;
}) {
  const completions = items.flatMap((item) => {
    if (
      item.kind !== "lesson" ||
      item.status !== "todo" ||
      !item.lessonId ||
      !item.scheduledFor ||
      toIsoDate(item.scheduledFor) >= date
    ) {
      return [];
    }

    const endedAt = new Date(
      (finishedOn.get(item.lessonId) ?? item.scheduledFor).getTime() +
        (item.chapterId === activeChapterId ? 2 : 1) * 3_600_000,
    );

    return [{ chapterId: item.chapterId, endedAt, lessonId: item.lessonId }];
  });

  await Promise.all(
    completions.map(async (completion) => {
      await learningEventFixture({
        contentIds: { chapterId: completion.chapterId, lessonId: completion.lessonId },
        endedAt: completion.endedAt,
        seconds: LESSON_MINUTES * 60,
        userId,
      });

      await prisma.$transaction(async (tx) => {
        await completeLessonPlanItems(tx, {
          lessonId: completion.lessonId,
          now: completion.endedAt,
          userId,
        });

        await upsertDailyProgress(tx, {
          clampedEnergy: 0,
          date: getDateInTimeZone({ date: completion.endedAt, timeZone: "UTC" }),
          durationSeconds: LESSON_MINUTES * 60,
          field: "staticCompleted",
          lessonsCompleted: 1,
          score: { brainPower: 0, correctCount: 0, incorrectCount: 0 },
          userId,
        });
      });
    }),
  );
}

type Fixture = Awaited<ReturnType<typeof setup>>;

async function readPromise(fixture: Fixture) {
  const before = await readSaved(fixture.plan.id);
  expect(findChapterInProgress(before.items)).toBe(fixture.activeChapterId);

  expect(
    before.items.find((item) => item.kind === "boss" && item.phase === 0)?.scheduledFor,
  ).toStrictEqual(new Date("2026-10-19"));

  expect(before.settings.mockFunding[0]).toMatchObject({
    date: "2026-10-18",
    day: 1,
    fullLength: false,
    minutes: 180,
  });

  expect(pastDonations(before.settings)).toStrictEqual([
    { date: START, minutes: 19.375 },
    { date: "2026-10-11", minutes: 19.375 },
  ]);

  const [shown, content] = await Promise.all([
    getGoalPlan(fixture.goal.id),
    getChapterView({ chapterId: fixture.activeChapterId, goalId: fixture.goal.id }),
  ]);

  if (shown.status !== "ready" || content.status !== "ready") {
    throw new Error("Expected the actual Plan and chapter content");
  }

  const nextLesson = content.chapter.lessons.find((lesson) => lesson.state === "next");

  const promise = shown.plan.week.days
    .flatMap((day) => day.items)
    .find((item) => item.lessonId === nextLesson?.lessonId);

  expect(promise?.scheduledFor).toBe(PROMISED_DAY);

  if (!promise?.lessonId || !promise.scheduledFor) {
    throw new Error("Expected a dated, explicitly shown next lesson");
  }

  return {
    before,
    promise: { ...promise, lessonId: promise.lessonId, scheduledFor: promise.scheduledFor },
  };
}

async function assertTeachingDay({
  fixture,
  bossId,
  lessonId,
}: {
  fixture: Fixture;
  bossId: string | undefined;
  lessonId: string;
}) {
  on(PROMISED_DAY);
  const today = await getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });
  const view = await getGoalPlan(fixture.goal.id);

  if (today.status !== "ready" || view.status !== "ready") {
    throw new Error("Expected the actual promised teaching day");
  }

  const saved = await readSaved(fixture.plan.id);

  const session = await prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: today.today.session.id },
  });

  const available = getGoalDayMinutes({
    date: new Date(PROMISED_DAY),
    goal: fixture.goal,
    planSettings: saved.settings,
  });

  const planDay = view.plan.week.days.find((day) => day.date === PROMISED_DAY);
  expect.soft(session.freshStart).not.toBe("welcomeBack");
  expect.soft(planDay?.minutes).toBeCloseTo(available, 6);
  expect.soft(today.today.session.minutes.dailyGoal).toBeCloseTo(available, 6);
  expect.soft(session.plannedMinutes).toBeLessThanOrEqual(available + 0.000001);
  const lessonBlock = session.blocks.find((block) => block.lessonId === lessonId);

  const bossBlock = session.blocks.find((block) => readBlockPayload(block).planItemId === bossId);

  expect.soft(lessonBlock).toBeDefined();
  expect.soft(lessonBlock?.estimatedMinutes).toBeGreaterThan(0);
  expect.soft(bossBlock?.estimatedMinutes).toBe(15);
  expect.soft(session.blocks[0]?.id).toBe(bossBlock?.id);

  expect
    .soft(planDay?.items.find((item) => item.lessonId === lessonId)?.scheduledFor)
    .toBe(PROMISED_DAY);

  if (
    !lessonBlock ||
    !bossBlock ||
    lessonBlock.estimatedMinutes === null ||
    bossBlock.estimatedMinutes === null
  ) {
    throw new Error("Expected actual boss and promised lesson durations");
  }

  expect
    .soft(lessonBlock.estimatedMinutes + bossBlock.estimatedMinutes)
    .toBeLessThanOrEqual(available + 0.000001);

  await expect
    .soft(startChallenge({ input: { timeZone: "UTC" }, planItemId: bossId ?? "" }))
    .resolves.toMatchObject({ destination: { kind: "checkpoint" }, status: "ready" });

  return saved;
}

function assertFunding({
  fixture,
  saved,
}: {
  fixture: Fixture;
  saved: Awaited<ReturnType<typeof readSaved>>;
}) {
  for (const entry of saved.settings.mockFunding) {
    const day = new Date(entry.date);

    const base = getGoalDayMinutes({
      date: day,
      goal: fixture.goal,
      planSettings: { ...saved.settings, mockFunding: [] },
    });

    expect
      .soft(entry.contributions.reduce((sum, contribution) => sum + contribution.minutes, 0) + base)
      .toBeGreaterThanOrEqual(entry.minutes + (entry.fixedMinutes ?? 0) - 0.000001);

    for (const contribution of entry.contributions) {
      const date = new Date(contribution.date);

      const beforeFunding = getGoalDayMinutes({
        date,
        goal: fixture.goal,
        planSettings: { ...saved.settings, mockFunding: [] },
      });

      const funded = getGoalDayMinutes({ date, goal: fixture.goal, planSettings: saved.settings });

      expect.soft(funded + contribution.minutes).toBeCloseTo(beforeFunding, 6);
      expect.soft(funded).toBeGreaterThanOrEqual(0);
    }
  }
}

async function assertNoAi(fixture: Fixture) {
  const calls = await prisma.aiCall.aggregate({
    _count: true,
    _sum: { costUsd: true },
    where: { OR: [{ goalId: fixture.goal.id }, { userId: fixture.user.id }] },
  });

  expect.soft(calls._count).toBe(0);
  expect.soft(calls._sum.costUsd ?? 0).toBe(0);

  const modelBoundaries = Object.entries(boundaries)
    .filter(([path]) => path.startsWith("@zoonk/ai/"))
    .flatMap(([, mocks]) => Object.values(mocks));

  for (const mock of modelBoundaries) {
    expect.soft(mock).not.toHaveBeenCalled();
  }
}

describe("promised teaching shares the real checkpoint and mock funding budget", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    on(START);
  });

  afterEach(() => vi.useRealTimers());

  it("keeps Linguagens' shown October 15 lesson when reducing its area advances the fixed boss", async () => {
    const fixture = await setup();
    const original = await readSaved(fixture.plan.id);

    await finishBefore({
      activeChapterId: fixture.activeChapterId,
      date: CHANGE_DAY,
      items: original.items,
      userId: fixture.user.id,
    });

    on(CHANGE_DAY);
    const { before, promise } = await readPromise(fixture);

    await expect(
      changeGoalPlan({
        goalId: fixture.goal.id,
        input: { operations: [{ areas: ["Linguagens"], kind: "reduceAreas" }], timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const after = await readSaved(fixture.plan.id);
    const promised = after.items.find((item) => item.lessonId === promise.lessonId);
    const boss = after.items.find((item) => item.kind === "boss" && item.phase === 0);

    expect
      .soft(boss?.id)
      .toBe(before.items.find((item) => item.kind === "boss" && item.phase === 0)?.id);

    expect.soft(boss?.scheduledFor).toStrictEqual(new Date(PROMISED_DAY));
    expect.soft(promised?.id).toBe(promise.id);

    expect
      .soft(promised?.scheduledFor && toIsoDate(promised.scheduledFor) <= promise.scheduledFor)
      .toBe(true);

    expect.soft(promised?.status).toBe("todo");

    await expect
      .soft(getChallenge({ input: { timeZone: "UTC" }, planItemId: boss?.id ?? "" }))
      .resolves.toMatchObject({
        challenge: { date: PROMISED_DAY, minutes: 15, status: "upcoming" },
        status: "ready",
      });

    await expect
      .soft(startChallenge({ input: { timeZone: "UTC" }, planItemId: boss?.id ?? "" }))
      .resolves.toMatchObject({ status: "notToday" });

    expect.soft(pastDonations(after.settings)).toStrictEqual(pastDonations(before.settings));

    expect
      .soft(after.settings.mockFunding.find((entry) => !entry.fullLength))
      .toMatchObject({ day: 1, minutes: 180 });

    const contentAfter = await getChapterView({
      chapterId: fixture.activeChapterId,
      goalId: fixture.goal.id,
    });

    expect
      .soft(contentAfter)
      .toMatchObject({
        chapter: {
          lessons: expect.arrayContaining([
            expect.objectContaining({ lessonId: promise.lessonId, state: "next" }),
          ]),
        },
        status: "ready",
      });

    // Starting an upcoming challenge opens today's real session and can refresh its saved plan.
    const beforeStudyDays = await readSaved(fixture.plan.id);

    const mathSkillId = fixture.graph.skills.find(
      (skill) => skill.area === "Matemática" && skill.phase === 0,
    )?.skillId;

    const pendingMath = beforeStudyDays.items.find(
      (item) => item.kind === "lesson" && item.skillId === mathSkillId && item.status === "todo",
    );

    if (!pendingMath?.lessonId) {
      throw new Error("Expected the same persisted pending Matemática lesson");
    }

    expect(pendingMath.scheduledFor).toStrictEqual(new Date(CHANGE_DAY));

    expect(after.items.find((item) => item.lessonId === pendingMath.lessonId)?.id).toBe(
      pendingMath.id,
    );
    // This first-day lesson opens on the 12th; the observed canonical teaching end is the 13th.
    await finishBefore({
      activeChapterId: fixture.activeChapterId,
      date: PROMISED_DAY,
      finishedOn: new Map([[pendingMath.lessonId, new Date("2026-10-13")]]),
      items: [pendingMath],
      userId: fixture.user.id,
    });

    const lastStudyDay = await prisma.dailyProgress.findFirst({
      orderBy: { date: "desc" },
      where: {
        date: { lt: new Date(PROMISED_DAY) },
        timeSpentSeconds: { gt: 0 },
        userId: fixture.user.id,
      },
    });

    expect(lastStudyDay?.date).toStrictEqual(new Date("2026-10-13"));

    const saved = await assertTeachingDay({
      bossId: boss?.id,
      fixture,
      lessonId: promise.lessonId,
    });

    assertFunding({ fixture, saved });

    await assertNoAi(fixture);
  });
});
