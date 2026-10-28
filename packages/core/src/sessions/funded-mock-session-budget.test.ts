import { type PlanItem, prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { after as afterResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { moveChallenge } from "../checkpoints/move-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { getMock } from "../exams/mocks/get-mock";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { upsertDailyProgress } from "../stats/daily-progress";
import { getTodayView } from "../view-models/today/get-today-view";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import { openTodayView } from "./_test-utils/open-today-view";
import { completeLessonPlanItems } from "./_utils/plan-items";
import { readBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

const START = "2020-09-28";
const ORIGINAL_MOCK = "2020-10-09";
const BOSS_DAY = "2020-10-16";
const COEVENT_DAY = "2020-10-19";
/** The mock's own week with the exam on Nov 9, and its Monday after, the first challenge's day. */
const MOCK_WEEK = "2020-10-05";
const SHARED_DAY = "2020-10-12";
/** The end of the plan's first week, which an automatic run keeps as saved. */
const WEEK_END = new Date("2020-10-04");
/** The first phase's challenge: the first study day after its last lessons, on the 6th. */
const FIRST_BOSS_DAY = "2020-10-07";

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "One point per correct answer", method: "raw" },
    sections: [{ day: 1, kind: "objective", minutes: 330, name: "Math", questions: 60 }],
    timeLimitMinutes: 330,
    totalQuestions: 60,
  },
  rules: [],
  subjects: [],
});

async function setup({
  targetDate = "2020-11-04",
  withBoss = false,
}: { targetDate?: string; withBoss?: boolean } = {}) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
    planLibraryFixture({
      skills: [
        { area: "Math", lessons: withBoss ? 200 : 60 },
        ...(withBoss ? [] : [{ area: "Science", lessons: 1 }]),
      ],
    }),
  ]);

  if (withBoss) {
    await prisma.lesson.updateMany({
      data: { estimatedMinutes: 4 },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    });
  }

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(START),
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: START, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] },
    targetDate: withBoss ? new Date(targetDate) : null,
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  await Promise.all(
    Array.from({ length: 30 }, () =>
      itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
    ),
  );

  mockSession(user.id);

  const selected = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { planId: plan.id },
  });

  return { goal, library, plan, selected, user };
}

/** What this week holds still to do: the days an automatic run keeps as saved. */
function thisWeek(items: PlanItem[]) {
  return items
    .filter((item) => item.status === "todo" && item.scheduledFor && item.scheduledFor <= WEEK_END)
    .map(({ id, kind, scheduledFor }) => ({ id, kind, scheduledFor }));
}

/**
 * Moves the week's mock as the learner can (R43): a normal re-plan keeps this week as saved and
 * carries the mock's exam day and the time this week set aside for it.
 */
async function moveMock({
  fixture,
  to,
}: {
  fixture: Awaited<ReturnType<typeof setup>>;
  to: string;
}) {
  const original = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });

  await expect(
    changeGoalPlan({
      goalId: fixture.goal.id,
      input: {
        operations: [{ from: ORIGINAL_MOCK, kind: "moveWeeklyEvent", to }],
        timeZone: "UTC",
      },
    }),
  ).resolves.toMatchObject({ status: "applied" });

  const saved = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: fixture.plan.id },
  });

  expect(thisWeek(saved.items)).toStrictEqual(thisWeek(fixture.selected));

  const before = parsePlanSettings(original.settings).mockFunding[0];
  const after = parsePlanSettings(saved.settings).mockFunding[0];

  const kept = (entry: typeof before) =>
    entry?.contributions.filter((part) => new Date(part.date) <= WEEK_END);

  expect(after).toMatchObject({ date: to, day: before?.day, minutes: 165 });
  expect(kept(after)).toStrictEqual(kept(before));

  return saved;
}

/** The ledger, plan checkoff and daily totals a real first lesson completion writes. */
async function finishTeaching({
  items,
  userId,
  beforeDate = BOSS_DAY,
}: {
  items: PlanItem[];
  userId: string;
  beforeDate?: string;
}) {
  return items.reduce<Promise<{ endedAt: Date; item: PlanItem; runId: string }[]>>(
    async (previous, item, index) => {
      const finished = await previous;

      if (!item.lessonId || !item.scheduledFor) {
        throw new Error("Expected an actual scheduled teaching item");
      }

      const scheduled = item.scheduledFor.toISOString().slice(0, 10);

      const ahead =
        scheduled >= beforeDate
          ? new Date(new Date(beforeDate).getTime() - 86_400_000).toISOString().slice(0, 10)
          : scheduled;

      const date = item.phase === 0 && scheduled === "2020-10-06" ? "2020-10-05" : ahead;
      const endedAt = new Date(new Date(`${date}T12:00:00Z`).getTime() + index * 240_000);
      expect(endedAt.getTime()).toBeLessThan(new Date(beforeDate).getTime());
      const lessonId = item.lessonId;

      const run = await learningEventFixture({
        contentIds: { lessonId },
        endedAt,
        seconds: 240,
        userId,
      });

      await prisma.$transaction(async (tx) => {
        await completeLessonPlanItems(tx, { lessonId, now: endedAt, userId });

        await upsertDailyProgress(tx, {
          clampedEnergy: 0,
          date: new Date(date),
          durationSeconds: 240,
          field: "staticCompleted",
          lessonsCompleted: 1,
          score: { brainPower: 0, correctCount: 0, incorrectCount: 0 },
          userId,
        });
      });

      return [...finished, { endedAt, item, runId: run.id }];
    },
    Promise.resolve([]),
  );
}

function readPlanItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

function writtenIds(items: PlanItem[]) {
  return items
    .filter((item) => item.kind === "lesson")
    .map((item) => item.lessonId)
    .toSorted((left, right) => (left ?? "").localeCompare(right ?? ""));
}

function doneTeaching(items: PlanItem[]) {
  return items
    .filter((item) => item.kind === "lesson" && item.status === "done")
    .map(({ completedAt, id, lessonId, scheduledFor }) => ({
      completedAt,
      id,
      lessonId,
      scheduledFor,
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

describe("funded mock sessions reserve all their fixed work", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => {
    vi.mocked(afterResponse).mockReset();
    vi.useRealTimers();
  });

  // The learner won the first challenge with two lessons done ahead, and the next phase's first six
  // too, at the pace lessons estimate: the session's refresh plans again from tomorrow (the pace's
  // source became their own) and fills the room their progress freed (P1 diagnosis: three lessons
  // of the same skill). It never takes a faster pace, and it says what it added.
  it("brings lessons back only as the learner's own progress frees room, and records it", async () => {
    const fixture = await setup({ withBoss: true });
    await moveMock({ fixture, to: BOSS_DAY });
    const finishDeferred = runDeferredWork();

    await prisma.lesson.updateMany({
      data: { contentStatus: "completed", specStatus: "completed" },
      where: { id: { in: fixture.library.lessons.map((lesson) => lesson.id) } },
    });

    const readItems = () =>
      prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { planId: fixture.plan.id },
      });

    const readPace = async () => {
      const saved = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
      return parsePlanSettings(saved.settings).pace;
    };

    const before = await readItems();
    const beforeIds = new Set(before.map((item) => item.id));

    // Every lesson the learner saw stays, as the same lesson: none removed, replaced or set aside.
    const keptLessons = (items: PlanItem[]) =>
      items
        .filter(
          (item) => item.kind === "lesson" && item.status !== "skipped" && beforeIds.has(item.id),
        )
        .map(({ id, lessonId }) => ({ id, lessonId }))
        .toSorted((left, right) => left.id.localeCompare(right.id));

    const shownLessons = keptLessons(before);
    const pace = await readPace();
    const first = before.find((item) => item.kind === "boss" && item.phase === 0);

    if (!first) {
      throw new Error("Expected the real first phase challenge");
    }

    // The challenge runs on top of its day, so finishing it on time frees none of the lessons'.
    const next = before.filter((item) => item.kind === "lesson" && item.phase === 1).slice(0, 6);

    await finishTeaching({
      beforeDate: FIRST_BOSS_DAY,
      items: [...before.filter((item) => item.kind === "lesson" && item.phase === 0), ...next],
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date(`${FIRST_BOSS_DAY}T12:00:00Z`));
    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: first.id });

    if (started.status !== "ready") {
      throw new Error(`Expected the actual first boss: ${started.status}`);
    }

    const { blockId, sessionId } = started.destination;
    await answerBlockInOrder({ blockId, sessionId });
    vi.setSystemTime(new Date(`${FIRST_BOSS_DAY}T12:15:00Z`));

    await expect(
      finishStudyBlock({ blockId, input: { timeZone: "UTC" }, sessionId }),
    ).resolves.toMatchObject({ status: "ready" });

    await finishDeferred();
    const completed = await readItems();
    const added = writtenIds(completed).length - writtenIds(before).length;

    expect(keptLessons(completed)).toStrictEqual(shownLessons);
    expect(added).toBeGreaterThan(0);

    const changes = await prisma.planChange.findMany({
      where: { kind: "estimateUpdated", planId: fixture.plan.id },
    });

    expect(changes).toHaveLength(1);

    expect(changes[0]?.payload).toMatchObject({
      effect: { lessonsAdded: added, lessonsRemoved: 0 },
      source: "system",
    });

    const completedPace = await readPace();
    expect(completedPace?.factor).toBeGreaterThanOrEqual(pace?.factor ?? 0);

    vi.setSystemTime(new Date("2020-10-08T12:00:00Z"));

    await expect(
      openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
    ).resolves.toMatchObject({ status: "ready" });

    await finishDeferred();
    await expect(readItems().then(keptLessons)).resolves.toStrictEqual(shownLessons);
    const openedPace = await readPace();
    expect(openedPace?.factor).toBeGreaterThanOrEqual(pace?.factor ?? 0);
  });

  // Moved to Monday in its own week, the mock shares the day the first phase's challenge was saved
  // on: the challenge stays there (a run never places one on the week it keeps), the day asks for
  // both, Today shows both before Open as Open saves them, and both start.
  it("funds and can start the real 15-minute boss before the 165-minute moved mock", async () => {
    const fixture = await setup({ targetDate: "2020-11-09", withBoss: true });
    const { goal, plan } = fixture;

    const studied = (before: string) =>
      readPlanItems(plan.id).then((items) =>
        items.filter(
          (item) =>
            item.kind === "lesson" &&
            item.status === "todo" &&
            item.scheduledFor !== null &&
            item.scheduledFor < new Date(before),
        ),
      );

    await prisma.lesson.updateMany({
      data: { contentStatus: "completed", specStatus: "completed" },
      where: { id: { in: fixture.library.lessons.map((lesson) => lesson.id) } },
    });

    await finishTeaching({
      beforeDate: MOCK_WEEK,
      items: await studied(MOCK_WEEK),
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date(`${MOCK_WEEK}T12:00:00Z`));
    await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    const opened = await readPlanItems(plan.id);
    const mock = opened.find((item) => item.kind === "mock" && item.status === "todo");
    const boss = opened.find((item) => item.kind === "boss" && item.phase === 0);

    expect(boss?.scheduledFor).toStrictEqual(new Date(SHARED_DAY));

    const moved = await moveChallenge({ input: { timeZone: "UTC" }, planItemId: mock?.id ?? "" });

    expect(moved).toMatchObject({ move: { date: SHARED_DAY }, status: "moved" });

    const saved = await readPlanItems(plan.id);

    const ofWeek = (items: PlanItem[]) =>
      items.filter(
        (item) =>
          item.status === "todo" && item.scheduledFor && item.scheduledFor < new Date(SHARED_DAY),
      );

    expect(ofWeek(saved).map(({ id, scheduledFor }) => ({ id, scheduledFor }))).toStrictEqual(
      ofWeek(opened)
        .filter((item) => item.id !== mock?.id)
        .map(({ id, scheduledFor }) => ({ id, scheduledFor })),
    );

    const onDay = saved.filter(
      (item) =>
        item.status === "todo" && item.scheduledFor?.toISOString().slice(0, 10) === SHARED_DAY,
    );

    const movedMock = onDay.find((item) => item.kind === "mock");

    expect(onDay.map((item) => item.kind).toSorted()).toStrictEqual(["boss", "mock"]);
    expect(onDay.find((item) => item.kind === "boss")?.id).toBe(boss?.id);

    await finishTeaching({
      beforeDate: SHARED_DAY,
      items: await studied(SHARED_DAY),
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date(`${SHARED_DAY}T12:00:00Z`));

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    const read = await countDatabaseStatements(() =>
      Promise.all([getTodayView({ goalId: goal.id, timeZone: "UTC" }), getGoalPlan(goal.id)]),
    );

    expect(read.writes).toBe(0);
    const [preview, planPreview] = read.result;

    if (preview.status !== "ready" || planPreview.status !== "ready") {
      throw new Error("Expected the saved shared day before Open");
    }

    expect(preview.today.session.minutes).toMatchObject({ dailyGoal: 180, planned: 180 });

    expect(preview.today.session.blocks.map((block) => block.planItemId)).toStrictEqual([
      boss?.id,
      movedMock?.id,
    ]);

    expect(preview.today.session.blocks.map((block) => block.estimatedMinutes)).toStrictEqual([
      15, 165,
    ]);

    expect(planPreview.plan.week.days.find((day) => day.date === SHARED_DAY)?.minutes).toBe(180);

    const today = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (today.status !== "ready") {
      throw new Error("Expected the actual shared day");
    }

    expect(today.today.session.minutes).toMatchObject({ dailyGoal: 180, planned: 180 });
    expect(today.today.planChange).toBeNull();

    const session = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: today.today.session.id },
    });

    const checkpoints = session.blocks.filter((block) => block.kind === "checkpoint");

    expect(checkpoints.map((block) => readBlockPayload(block).planItemId)).toStrictEqual([
      boss?.id,
      movedMock?.id,
    ]);

    expect(checkpoints.map((block) => block.estimatedMinutes)).toStrictEqual([15, 165]);
    expect(session.plannedMinutes).toBe(180);

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanSettings(after.settings).mockFunding).toStrictEqual(
      parsePlanSettings(before.settings).mockFunding,
    );

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss?.id ?? "" }),
    ).resolves.toMatchObject({ destination: { kind: "checkpoint" }, status: "ready" });

    const started = await startChallenge({
      input: { timeZone: "UTC" },
      planItemId: movedMock?.id ?? "",
    });

    if (started.status !== "ready") {
      throw new Error(`Expected the funded mock to start: ${started.status}`);
    }

    await expect(getMock(started.destination.blockId)).resolves.toMatchObject({
      mock: { minutes: 165, status: "running" },
      status: "ready",
    });
  });

  // A learner who moved the week's mock onto a day, then left the first two phases' challenges: a
  // challenge's time runs on top of its day, so the run carries them past the day the learner moved
  // the mock onto, to the next study day. The mock keeps its day and funding, and every lesson stays.
  it("carries overdue challenges past the mock's day, keeping the mock and every lesson", async () => {
    const fixture = await setup({ withBoss: true });
    const original = await moveMock({ fixture, to: BOSS_DAY });

    const readPlan = () =>
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: fixture.plan.id },
      });

    await prisma.lesson.updateMany({
      data: { contentStatus: "completed", specStatus: "completed" },
      where: { id: { in: fixture.library.lessons.map((lesson) => lesson.id) } },
    });

    await finishTeaching({
      items: original.items.filter((item) => item.kind === "lesson" && item.phase === 0),
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date(`${FIRST_BOSS_DAY}T12:00:00Z`));
    const skipped = await openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });

    if (skipped.status !== "ready") {
      throw new Error("Expected the first boss day");
    }

    // The first phase's challenge leads its day's lessons, its time on top of theirs.
    expect(skipped.today.session.blocks.map((block) => block.planItemId)).toStrictEqual([
      original.items.find((item) => item.kind === "boss" && item.phase === 0)?.id,
      ...original.items
        .filter(
          (item) =>
            item.kind === "lesson" &&
            item.scheduledFor?.toISOString().slice(0, 10) === FIRST_BOSS_DAY,
        )
        .map((item) => item.id),
    ]);

    await finishTeaching({
      items: original.items.filter((item) => item.kind === "lesson" && item.phase === 1),
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date(`${BOSS_DAY}T12:00:00Z`));
    const before = await readPlan();
    const mock = before.items.find((item) => item.kind === "mock");
    const overdue = before.items.filter((item) => item.kind === "boss" && item.phase <= 1);

    const preview = await countDatabaseStatements(() =>
      getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
    );

    expect(preview.writes).toBe(0);

    if (preview.result.status !== "ready") {
      throw new Error("Expected the mock's day before Open");
    }

    expect(preview.result.today.session.blocks.map((block) => block.planItemId)).toContain(
      mock?.id,
    );

    await expect(readPlan()).resolves.toStrictEqual(before);

    const today = await openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });
    const after = await readPlan();

    if (today.status !== "ready") {
      throw new Error("Expected actual Today");
    }

    expect(today.today.session.blocks.map((block) => block.planItemId)).toStrictEqual([mock?.id]);
    expect(today.today.session.minutes).toMatchObject({ dailyGoal: 165, planned: 165 });

    expect(after.items.find((item) => item.kind === "mock")).toMatchObject({
      id: mock?.id,
      scheduledFor: new Date(BOSS_DAY),
      status: "todo",
    });

    expect(parsePlanSettings(after.settings).mockFunding).toStrictEqual(
      parsePlanSettings(before.settings).mockFunding,
    );

    expect(after.items.filter((item) => item.kind === "boss" && item.phase <= 1)).toMatchObject(
      overdue.map((item) => ({ id: item.id, scheduledFor: new Date(COEVENT_DAY), status: "todo" })),
    );

    expect(parsePlanSettings(after.settings).checkpointOverflow).toContainEqual({
      date: COEVENT_DAY,
      minutes: 30,
    });

    expect(writtenIds(after.items)).toStrictEqual(writtenIds(before.items));
    expect(doneTeaching(after.items)).toStrictEqual(doneTeaching(before.items));
  });

  it("leaves an independent three-question due capsule for later when the mock fills all 165 minutes", async () => {
    const { goal, library, plan, user } = await setup();
    const skillId = library.skills[1]?.id ?? "";

    const questions = await Promise.all(
      Array.from({ length: 3 }, () => itemFixture({ content: choiceItemContent(), skillId })),
    );

    await Promise.all([
      learnerSkillFixture({
        difficulty: 5,
        due: new Date("2020-10-08"),
        lastReviewedAt: new Date("2020-10-05"),
        reps: 2,
        skillId,
        stability: 3,
        state: "learning",
        userId: user.id,
      }),
      ...questions.map((item) =>
        attemptFixture({
          answeredAt: new Date("2020-10-05T12:00:00Z"),
          itemId: item.id,
          skillId,
          userId: user.id,
        }),
      ),
    ]);

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(
      parsePlanSettings(saved.settings).mockFunding.find((entry) => entry.date === ORIGINAL_MOCK)
        ?.minutes,
    ).toBe(165);

    vi.setSystemTime(new Date(`${ORIGINAL_MOCK}T12:00:00Z`));
    const result = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (result.status !== "ready") {
      throw new Error("Expected the actual mock session");
    }

    const session = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true },
      where: { id: result.today.session.id },
    });

    const fixed = session.blocks.find((block) => readBlockPayload(block).checkpoint?.mock);
    expect(fixed?.estimatedMinutes).toBe(165);

    if (!fixed) {
      throw new Error("Expected the fixed mock block");
    }

    const reserved = new Set(readBlockPayload(fixed).itemIds);
    expect(questions.every((question) => !reserved.has(question.id))).toBe(true);
    expect.soft(session.blocks.filter((block) => block.kind === "review")).toStrictEqual([]);
    expect.soft(session.plannedMinutes).toBe(165);
    expect.soft(result.today.session.minutes).toMatchObject({ dailyGoal: 165, planned: 165 });

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({ where: { userSkill: { skillId, userId: user.id } } }),
    ).resolves.toMatchObject({ due: new Date("2020-10-08"), reps: 2 });
  });
});
