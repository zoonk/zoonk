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
import { getChallenge } from "../checkpoints/get-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { getMock } from "../exams/mocks/get-mock";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { readTodayChange } from "../plans/_test-utils/estimate-plan";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { upsertDailyProgress } from "../stats/daily-progress";
import { getTodayView } from "../view-models/today/get-today-view";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import { openTodayView } from "./_test-utils/open-today-view";
import { completeLessonPlanItems, completePlanItem } from "./_utils/plan-items";
import { readBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

const START = "2020-09-28";
const ORIGINAL_MOCK = "2020-10-09";
const BOSS_DAY = "2020-10-16";
const COEVENT_DAY = "2020-10-19";
/** The first phase's challenge: the first study day after its last lessons, on the 6th. */
const FIRST_BOSS_DAY = "2020-10-07";

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    citations: [],
    order: null,
    scoring: { description: "One point per correct answer", method: "raw" },
    sections: [{ day: 1, minutes: 330, name: "Math", questions: 60 }],
    timeLimitMinutes: 330,
    totalQuestions: 60,
  },
  rules: [],
  subjects: [],
});

async function setup({ withBoss = false }: { withBoss?: boolean } = {}) {
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
    targetDate: withBoss ? new Date("2020-11-04") : null,
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

function teaching(items: PlanItem[]) {
  return items
    .filter((item) => item.kind === "lesson")
    .map(({ id, lessonId, phase }) => ({ id, lessonId, phase }));
}

function bosses(items: PlanItem[]) {
  return items
    .filter((item) => item.kind === "boss")
    .map(({ id, scheduledFor }) => ({ id, scheduledFor }));
}

function expectSavedSelection({ after, before }: { after: PlanItem[]; before: PlanItem[] }) {
  expect(teaching(after)).toStrictEqual(teaching(before));
  expect(teaching(after)).toHaveLength(45);

  expect(
    [0, 1, 2].map((phase) => teaching(after).filter((item) => item.phase === phase).length),
  ).toStrictEqual([14, 16, 15]);

  expect(bosses(after)).toStrictEqual(bosses(before));

  expect(bosses(after).map((item) => item.scheduledFor?.toISOString().slice(0, 10))).toStrictEqual([
    FIRST_BOSS_DAY,
    COEVENT_DAY,
    "2020-10-29",
  ]);
}

/** Reach the saved boss through two valid week-bounded moves; the boss is never moved. */
async function moveOntoSavedBoss(fixture: Awaited<ReturnType<typeof setup>>) {
  const original = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });

  await [
    { from: ORIGINAL_MOCK, to: "2020-10-12" },
    { from: "2020-10-12", to: COEVENT_DAY },
  ].reduce(async (previous, move) => {
    await previous;

    await expect(
      changeGoalPlan({
        goalId: fixture.goal.id,
        input: { operations: [{ ...move, kind: "moveWeeklyEvent" }], timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "applied" });
  }, Promise.resolve());

  const saved = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: fixture.plan.id },
  });

  expectSavedSelection({ after: saved.items, before: fixture.selected });
  const before = parsePlanSettings(original.settings).mockFunding[0];
  const after = parsePlanSettings(saved.settings).mockFunding[0];

  if (!before || !after) {
    throw new Error("Expected the real saved mock bank");
  }

  expect(before.contributions).toHaveLength(9);
  expect(after).toMatchObject({ date: COEVENT_DAY, fixedMinutes: 15, minutes: 165 });
  expect(after.contributions).toHaveLength(14);
  const oldDates = new Set(before.contributions.map((part) => part.date));

  expect(after.contributions.filter((part) => oldDates.has(part.date))).toStrictEqual(
    before.contributions,
  );

  expect(after.contributions.filter((part) => !oldDates.has(part.date))).toStrictEqual([
    { date: "2020-10-12", minutes: 8.333333333333334 },
    { date: "2020-10-13", minutes: 1.6666666666666667 },
    { date: "2020-10-14", minutes: 1.6666666666666667 },
    { date: "2020-10-15", minutes: 1.6666666666666667 },
    { date: "2020-10-16", minutes: 1.6666666666666667 },
  ]);

  return after;
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

/** Saved progress is the fixture premise; opening the co-event exercises the real session path. */
async function saveProgressBeforeBossDay(fixture: Awaited<ReturnType<typeof setup>>) {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { planId: fixture.plan.id },
  });

  await prisma.lesson.updateMany({
    data: { contentStatus: "completed", specStatus: "completed" },
    where: { id: { in: fixture.library.lessons.map((lesson) => lesson.id) } },
  });

  const phaseLessons = (phase: number) =>
    items.filter((item) => item.kind === "lesson" && item.phase === phase);

  expect(phaseLessons(0)).toHaveLength(14);

  expect(
    phaseLessons(1).map((item) => item.scheduledFor?.toISOString().slice(0, 10)),
  ).toStrictEqual([
    "2020-10-09",
    "2020-10-09",
    "2020-10-09",
    "2020-10-09",
    "2020-10-13",
    "2020-10-13",
    "2020-10-13",
    "2020-10-14",
    "2020-10-14",
    "2020-10-14",
    "2020-10-15",
    "2020-10-15",
    "2020-10-15",
    "2020-10-15",
    "2020-10-16",
    "2020-10-16",
  ]);

  const first = await finishTeaching({
    beforeDate: COEVENT_DAY,
    items: phaseLessons(0),
    userId: fixture.user.id,
  });

  const boss = items.find((item) => item.kind === "boss" && item.phase === 0);
  expect(boss?.scheduledFor).toStrictEqual(new Date(FIRST_BOSS_DAY));

  if (!boss) {
    throw new Error("Expected the saved first phase challenge");
  }

  const completedAt = new Date(`${FIRST_BOSS_DAY}T12:15:00Z`);

  await learningEventFixture({
    contentIds: { planItemId: boss.id },
    endedAt: completedAt,
    kind: "checkpoint",
    seconds: 900,
    userId: fixture.user.id,
  });

  await prisma.$transaction(async (tx) => {
    await completePlanItem(tx, { now: completedAt, planItemId: boss.id, userId: fixture.user.id });

    await upsertDailyProgress(tx, {
      clampedEnergy: 0,
      date: new Date(FIRST_BOSS_DAY),
      durationSeconds: 900,
      field: "interactiveCompleted",
      lessonsCompleted: 0,
      score: { brainPower: 0, correctCount: 10, incorrectCount: 0 },
      userId: fixture.user.id,
    });
  });

  await expect(
    prisma.planItem.findUniqueOrThrow({ where: { id: boss?.id } }),
  ).resolves.toMatchObject({
    completedAt: new Date(`${FIRST_BOSS_DAY}T12:15:00Z`),
    scheduledFor: new Date(FIRST_BOSS_DAY),
    status: "done",
  });

  await expect(
    prisma.learningEvent.findFirstOrThrow({
      where: { kind: "checkpoint", userId: fixture.user.id },
    }),
  ).resolves.toMatchObject({
    contentIds: { planItemId: boss?.id },
    endedAt: new Date(`${FIRST_BOSS_DAY}T12:15:00Z`),
    seconds: 900,
    startedAt: new Date(`${FIRST_BOSS_DAY}T12:00:00Z`),
  });

  expect(fixture.library.lessons).toHaveLength(200);
  expect(fixture.library.graph.skills).toMatchObject([{ lessons: 200, phase: 0 }]);

  const nextTeaching = items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.phase > 0 &&
      item.scheduledFor !== null &&
      item.scheduledFor < new Date(COEVENT_DAY),
  );

  expect(nextTeaching.map((item) => item.lessonId)).toStrictEqual(
    fixture.library.lessons.slice(14, 31).map((lesson) => lesson.id),
  );

  const second = await finishTeaching({
    beforeDate: COEVENT_DAY,
    items: nextTeaching,
    userId: fixture.user.id,
  });

  const finished = [...first, ...second];

  const [savedItems, runs, progress] = await Promise.all([
    prisma.planItem.findMany({ where: { id: { in: finished.map(({ item }) => item.id) } } }),
    prisma.learningEvent.findMany({ where: { id: { in: finished.map(({ runId }) => runId) } } }),
    prisma.dailyProgress.findMany({ where: { userId: fixture.user.id } }),
  ]);

  for (const { endedAt, item, runId } of finished) {
    expect(savedItems.find((saved) => saved.id === item.id)).toMatchObject({
      completedAt: endedAt,
      lessonId: item.lessonId,
      scheduledFor: item.scheduledFor,
      status: "done",
    });

    expect(runs.find((run) => run.id === runId)).toMatchObject({
      contentIds: { lessonId: item.lessonId },
      endedAt,
      localDate: new Date(endedAt.toISOString().slice(0, 10)),
      seconds: 240,
    });
  }

  const dates = [...new Set(finished.map(({ endedAt }) => endedAt.toISOString().slice(0, 10)))];

  for (const date of dates) {
    const count = finished.filter(
      ({ endedAt }) => endedAt.toISOString().slice(0, 10) === date,
    ).length;

    expect(progress.find((day) => day.date.toISOString().slice(0, 10) === date)).toMatchObject({
      lessonsCompleted: count,
      staticCompleted: count,
      timeSpentSeconds: count * 240,
    });
  }

  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });

  await prisma.plan.update({
    data: { settings: { ...parsePlanSettings(plan.settings), pace: { factor: 1, source: "own" } } },
    where: { id: fixture.plan.id },
  });

  const selected = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { planId: fixture.plan.id },
  });

  expectSavedSelection({ after: selected, before: items });
  vi.setSystemTime(new Date("2020-10-18T18:00:00Z"));
  return { items, selected };
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

  // The learner won the first challenge with two lessons done ahead, at the pace lessons estimate:
  // the session's refresh plans again from tomorrow (the pace's source became their own) and fills
  // the room their progress freed (P1 diagnosis: three lessons of the same skill). It never takes a
  // faster pace, and it says what it added.
  it("brings lessons back only as the learner's own progress frees room, and says so", async () => {
    const fixture = await setup({ withBoss: true });
    await moveOntoSavedBoss(fixture);
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

    const readPace = async () =>
      parsePlanSettings(
        (await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } })).settings,
      ).pace;

    const before = await readItems();
    expect(writtenIds(before)).toHaveLength(45);
    const beforeIds = new Set(before.map((item) => item.id));

    // Every lesson the learner saw stays, as the same lesson: none removed or replaced.
    const keptLessons = (items: PlanItem[]) =>
      items
        .filter((item) => item.kind === "lesson" && beforeIds.has(item.id))
        .map(({ id, lessonId }) => ({ id, lessonId }))
        .toSorted((left, right) => left.id.localeCompare(right.id));

    const shownLessons = keptLessons(before);
    const pace = await readPace();
    const first = before.find((item) => item.kind === "boss" && item.phase === 0);

    if (!first) {
      throw new Error("Expected the real first phase challenge");
    }

    await finishTeaching({
      beforeDate: FIRST_BOSS_DAY,
      items: before.filter((item) => item.kind === "lesson" && item.phase === 0),
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

    await expect(readTodayChange(fixture.goal.id)).resolves.toMatchObject({
      id: changes[0]?.id,
      kind: "estimateUpdated",
    });

    expect((await readPace())?.factor).toBeGreaterThanOrEqual(pace?.factor ?? 0);

    vi.setSystemTime(new Date("2020-10-08T12:00:00Z"));

    await expect(
      openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
    ).resolves.toMatchObject({ status: "ready" });

    await finishDeferred();
    await expect(readItems().then(keptLessons)).resolves.toStrictEqual(shownLessons);
    expect((await readPace())?.factor).toBeGreaterThanOrEqual(pace?.factor ?? 0);
  });

  it("funds and can start the real 15-minute boss before the 165-minute moved mock", async () => {
    const fixture = await setup({ withBoss: true });
    const { goal, plan } = fixture;

    const movedFunding = await moveOntoSavedBoss(fixture);

    const { items: movedItems, selected } = await saveProgressBeforeBossDay(fixture);

    const saved = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    const onDay = saved.items.filter(
      (item) => item.scheduledFor?.toISOString().slice(0, 10) === COEVENT_DAY,
    );

    const boss = onDay.find((item) => item.kind === "boss");
    const mock = onDay.find((item) => item.kind === "mock");

    if (!boss || !mock) {
      throw new Error("Expected the saved boss and mock on their actual co-event day");
    }

    expect(onDay.map((item) => item.kind).toSorted()).toStrictEqual(["boss", "mock"]);
    expect(boss.id).toBe(movedItems.find((item) => item.kind === "boss" && item.phase === 1)?.id);
    expect(mock.id).toBe(movedItems.find((item) => item.kind === "mock")?.id);
    expect(parsePlanSettings(saved.settings).pace).toMatchObject({ factor: 1, source: "own" });
    expect(parsePlanSettings(saved.settings).mockFunding).toStrictEqual([movedFunding]);
    expect(writtenIds(saved.items)).toStrictEqual(writtenIds(selected));
    expectSavedSelection({ after: saved.items, before: selected });

    expect(
      saved.items.filter(
        (item) => item.kind === "lesson" && item.phase <= 1 && item.status === "todo",
      ),
    ).toStrictEqual([]);

    expect
      .soft(
        parsePlanSettings(saved.settings).mockFunding.find((entry) => entry.date === COEVENT_DAY),
      )
      .toMatchObject({ fixedMinutes: 15, minutes: 165 });

    vi.setSystemTime(new Date(`${COEVENT_DAY}T12:00:00Z`));

    const read = await countDatabaseStatements(() =>
      Promise.all([getTodayView({ goalId: goal.id, timeZone: "UTC" }), getGoalPlan(goal.id)]),
    );

    expect(read.writes).toBe(0);
    const [preview, planPreview] = read.result;

    if (preview.status !== "ready" || planPreview.status !== "ready") {
      throw new Error("Expected the saved co-event day before Open");
    }

    expect(preview.today.session.minutes).toMatchObject({ dailyGoal: 180, planned: 180 });

    expect(preview.today.session.blocks.map((block) => block.planItemId)).toStrictEqual([
      boss.id,
      mock.id,
    ]);

    expect(preview.today.session.blocks.map((block) => block.estimatedMinutes)).toStrictEqual([
      15, 165,
    ]);

    expect(planPreview.plan.week.days.find((day) => day.date === COEVENT_DAY)?.minutes).toBe(180);

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      }),
    ).resolves.toStrictEqual(saved);

    const [today, view] = await Promise.all([
      openTodayView({ goalId: goal.id, timeZone: "UTC" }),
      getGoalPlan(goal.id),
    ]);

    if (today.status !== "ready" || view.status !== "ready") {
      throw new Error("Expected the actual funded day");
    }

    expect.soft(view.plan.week.days.find((day) => day.date === COEVENT_DAY)?.minutes).toBe(180);
    expect.soft(today.today.session.minutes.dailyGoal).toBe(180);
    expect.soft(today.today.session.minutes.planned).toBe(180);
    expect(today.today.planChange).toBeNull();

    const session = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: today.today.session.id },
    });

    const checkpoints = session.blocks.filter((block) => block.kind === "checkpoint");

    expect
      .soft(checkpoints.map((block) => readBlockPayload(block).planItemId))
      .toStrictEqual([boss.id, mock.id]);

    expect.soft(checkpoints.map((block) => block.estimatedMinutes)).toStrictEqual([15, 165]);
    expect.soft(session.plannedMinutes).toBe(180);

    const afterToday = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    expect(parsePlanSettings(afterToday.settings).mockFunding).toStrictEqual(
      parsePlanSettings(saved.settings).mockFunding,
    );

    expect(parsePlanSettings(afterToday.settings).pace).toMatchObject({ factor: 1, source: "own" });
    expect(writtenIds(afterToday.items)).toStrictEqual(writtenIds(saved.items));
    expectSavedSelection({ after: afterToday.items, before: saved.items });
    expect(doneTeaching(afterToday.items)).toStrictEqual(doneTeaching(saved.items));

    expect(afterToday.items.find((item) => item.id === boss.id)?.scheduledFor).toStrictEqual(
      new Date(COEVENT_DAY),
    );

    expect(afterToday.items.find((item) => item.id === mock.id)?.scheduledFor).toStrictEqual(
      new Date(COEVENT_DAY),
    );

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id ?? "" }),
    ).resolves.toMatchObject({ destination: { kind: "checkpoint" }, status: "ready" });

    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: mock.id ?? "" });

    expect.soft(started).toMatchObject({ destination: { kind: "mock" }, status: "ready" });

    if (started.status !== "ready") {
      throw new Error(`Expected the funded mock to start: ${started.status}`);
    }

    await expect(getMock(started.destination.blockId)).resolves.toMatchObject({
      mock: { minutes: 165, status: "running" },
      status: "ready",
    });
  });

  it("discloses the lost last lesson and funded mock relocation when overdue bosses take the day", async () => {
    const fixture = await setup({ withBoss: true });

    await expect(
      changeGoalPlan({
        goalId: fixture.goal.id,
        input: {
          operations: [{ from: ORIGINAL_MOCK, kind: "moveWeeklyEvent", to: BOSS_DAY }],
          timeZone: "UTC",
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const original = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: fixture.plan.id },
    });

    expectSavedSelection({ after: original.items, before: fixture.selected });

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
    expect(skipped).toMatchObject({ status: "ready" });

    if (skipped.status !== "ready") {
      throw new Error("Expected the first boss day");
    }

    expect(skipped.today.session.blocks.map((block) => block.planItemId)).toStrictEqual([
      original.items.find((item) => item.kind === "boss" && item.phase === 0)?.id,
    ]);

    await finishTeaching({
      items: original.items.filter((item) => item.kind === "lesson" && item.phase === 1),
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date(`${BOSS_DAY}T12:00:00Z`));

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: fixture.plan.id },
    });

    const beforeView = await getGoalPlan(fixture.goal.id);

    const preview = await countDatabaseStatements(() =>
      getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
    );

    expect(preview.writes).toBe(0);
    expect(preview.result.status).toBe("ready");

    if (preview.result.status !== "ready") {
      throw new Error("Expected the selected missed-day preview");
    }

    // The selected mock stays visible; its intro opens only after its row is persisted.
    expect(preview.result.today.weeklyChallenge).toMatchObject({
      date: new Date("2020-10-20"),
      kind: "mock",
      planItemId: null,
      questions: 30,
      timeLimitMinutes: 165,
    });

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: fixture.plan.id },
      }),
    ).resolves.toStrictEqual(before);

    const today = await openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });

    const after = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: fixture.plan.id },
    });

    const view = await getGoalPlan(fixture.goal.id);
    const mock = after.items.find((item) => item.kind === "mock");
    const card = await getChallenge({ input: { timeZone: "UTC" }, planItemId: mock?.id ?? "" });

    expect(today.status).toBe("ready");

    if (today.status !== "ready") {
      throw new Error("Expected actual Today");
    }

    const oldMock = before.items.find((item) => item.kind === "mock");

    expect(
      before.items
        .filter((item) => item.scheduledFor?.toISOString().slice(0, 10) === BOSS_DAY)
        .map((item) => item.kind)
        .toSorted(),
    ).toStrictEqual(["mock"]);

    const beforeFunding = parsePlanSettings(before.settings).mockFunding;
    const afterFunding = parsePlanSettings(after.settings).mockFunding;
    expect(beforeView).toMatchObject({ status: "ready" });

    if (beforeView.status !== "ready") {
      throw new Error("Expected the funded coevent Plan");
    }

    // Read-only Plan already projects the real missed-day relocation; the saved premise stays165.
    expect(beforeView.plan.week.days.find((day) => day.date === BOSS_DAY)?.minutes).toBe(30);
    expect(view.status).toBe("ready");

    if (view.status !== "ready") {
      throw new Error("Expected the persisted relocated Plan");
    }

    const visible = (plan: typeof view.plan) =>
      plan.week.days
        .flatMap((day) => day.items)
        .map(({ kind, scheduledFor, title }) => ({ kind, scheduledFor, title }));

    expect(visible(beforeView.plan)).toStrictEqual(visible(view.plan));

    expect(before.items.find((item) => item.kind === "boss" && item.phase === 0)).toMatchObject({
      completedAt: null,
      scheduledFor: new Date(FIRST_BOSS_DAY),
      status: "todo",
    });

    expect(beforeFunding).toHaveLength(1);
    expect(beforeFunding[0]).not.toHaveProperty("fixedMinutes");

    expect(beforeFunding[0]).toMatchObject({
      date: BOSS_DAY,
      day: 1,
      fullLength: false,
      minutes: 165,
    });

    expect(afterFunding).toHaveLength(1);

    expect(afterFunding[0]).toMatchObject({
      date: "2020-10-20",
      day: 1,
      fullLength: false,
      minutes: 165,
    });

    expect(afterFunding[0]).not.toHaveProperty("fixedMinutes");

    expect(afterFunding[0]?.contributions).toStrictEqual(beforeFunding[0]?.contributions);
    expect(afterFunding[0]?.contributions).toHaveLength(9);

    expect(parsePlanSettings(after.settings).mockRelocations).toStrictEqual([
      { from: BOSS_DAY, to: "2020-10-20" },
    ]);

    expect(parsePlanSettings(after.settings).movedEvents).toStrictEqual([
      { from: ORIGINAL_MOCK, to: BOSS_DAY },
    ]);

    expect(after.items.filter((item) => item.kind === "mock")).toHaveLength(1);

    expect(mock).toMatchObject({
      completedAt: null,
      scheduledFor: new Date("2020-10-20"),
      status: "todo",
    });

    expect(doneTeaching(after.items)).toStrictEqual(doneTeaching(before.items));

    expect(after.items.filter((item) => item.kind === "boss" && item.phase <= 1)).toMatchObject(
      before.items
        .filter((item) => item.kind === "boss" && item.phase <= 1)
        .map((item) => ({
          completedAt: null,
          id: item.id,
          scheduledFor: new Date(BOSS_DAY),
          status: "todo",
        })),
    );

    expect(
      after.items
        .filter((item) => item.scheduledFor?.toISOString().slice(0, 10) === "2020-10-19")
        .map((item) => item.id),
    ).toStrictEqual(
      before.items
        .filter((item) => item.kind === "lesson" && item.phase === 2)
        .slice(0, 2)
        .map((item) => item.id),
    );

    expect(
      after.items
        .filter((item) => item.scheduledFor?.toISOString().slice(0, 10) === "2020-10-19")
        .map((item) => item.kind),
    ).toStrictEqual(["lesson", "lesson"]);

    expect(
      after.items
        .filter((item) => item.scheduledFor?.toISOString().slice(0, 10) === "2020-10-19")
        .map((item) => item.lessonId),
    ).toStrictEqual(fixture.library.lessons.slice(30, 32).map((lesson) => lesson.id));

    const lost = fixture.library.lessons.at(44);

    if (!lost) {
      throw new Error("Expected the last selected lesson");
    }

    expect(before.items.find((item) => item.lessonId === lost.id)).toMatchObject({
      completedAt: null,
      scheduledFor: new Date("2020-10-28"),
      status: "todo",
    });

    expect(writtenIds(after.items)).toStrictEqual(
      writtenIds(before.items).filter((lessonId) => lessonId !== lost.id),
    );

    expect(after.items.some((item) => item.id === oldMock?.id)).toBe(false);
    expect(today.today.session.minutes).toMatchObject({ dailyGoal: 30, planned: 30 });

    expect(today.today.session.blocks.map((block) => block.planItemId)).toStrictEqual(
      before.items.filter((item) => item.kind === "boss" && item.phase <= 1).map((item) => item.id),
    );

    expect(today.today.session.blocks.map((block) => block.estimatedMinutes)).toStrictEqual([
      15, 15,
    ]);

    expect(today.today.planChange).toMatchObject({
      days: 1,
      effect: {
        lessonsAdded: 0,
        lessonsRemoved: 1,
        nextMock: { after: "2020-10-20", before: BOSS_DAY },
      },
      kind: "missedDays",
      seen: false,
      source: "system",
      status: "applied",
    });

    expect(view).toMatchObject({ status: "ready" });

    if (view.status !== "ready") {
      throw new Error("Expected actual Plan");
    }

    expect(view.plan.week.days.find((day) => day.date === BOSS_DAY)?.minutes).toBe(30);

    expect(view.plan.phases.find((phase) => phase.index === 2)?.mocks).toStrictEqual({
      count: 1,
      nextDate: "2020-10-20",
    });

    const session = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: today.today.session.id },
    });

    expect(session.plannedMinutes).toBe(30);

    expect(session.blocks.map((block) => readBlockPayload(block).planItemId)).toStrictEqual(
      before.items.filter((item) => item.kind === "boss" && item.phase <= 1).map((item) => item.id),
    );

    expect(session.blocks.map((block) => block.estimatedMinutes)).toStrictEqual([15, 15]);

    expect(card).toMatchObject({
      challenge: {
        date: "2020-10-20",
        fullLength: false,
        minutes: 165,
        planItemId: mock?.id,
        status: "upcoming",
      },
      status: "ready",
    });
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
