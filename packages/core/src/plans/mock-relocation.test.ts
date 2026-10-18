import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { addDays, fromIsoDate, toIsoDate } from "./planner/plan-calendar";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

const START = "2020-09-28";
const LATER_TODAY = "2020-09-29";

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

async function readSaved(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

function mockOn(plan: Awaited<ReturnType<typeof readSaved>>, date: string) {
  const item = plan.items.find(
    (entry) => entry.kind === "mock" && entry.scheduledFor?.toISOString().slice(0, 10) === date,
  );

  if (!item) {
    throw new Error(`Expected the actual mock on ${date}`);
  }

  return item;
}

function nextWeekday(date: string): string {
  const next = addDays(fromIsoDate(date), 1);

  if (next.getUTCDay() === 6) {
    return toIsoDate(addDays(next, 2));
  }

  if (next.getUTCDay() === 0) {
    return toIsoDate(addDays(next, 1));
  }

  return toIsoDate(next);
}

function lessonAndBossFacts(plan: Awaited<ReturnType<typeof readSaved>>) {
  return plan.items
    .filter((item) => item.kind === "lesson" || item.kind === "boss")
    .map(({ completedAt, id, kind, phase, scheduledFor, status }) => ({
      completedAt,
      id,
      kind,
      phase,
      scheduledFor,
      status,
    }))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

async function setup() {
  const [user, library, blueprint] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ area: "Math", lessons: 200 }] }),
    examBlueprintFixture({ structure: STRUCTURE }),
  ]);

  await Promise.all([
    prisma.lesson.updateMany({
      data: { estimatedMinutes: 4 },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    }),
    ...Array.from({ length: 10 }, () =>
      itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(START),
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: START, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] },
    targetDate: new Date("2020-11-07"),
    timezone: "UTC",
    userId: user.id,
  });

  // Auth/cache use the shared request harness; planning, changes and saved funding are real.
  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  const created = await readSaved(plan.id);
  const boss = created.items.find((item) => item.kind === "boss" && item.phase === 1);

  if (!boss?.scheduledFor) {
    throw new Error("Expected the actual second phase's boss");
  }

  const source = created.items.findLast(
    (item) =>
      item.kind === "mock" && item.scheduledFor !== null && item.scheduledFor < boss.scheduledFor!,
  );

  if (!source?.scheduledFor) {
    throw new Error("Expected a real mock before the second phase's boss");
  }

  const NATIVE = toIsoDate(addDays(source.scheduledFor, 7));
  const PRIOR_MOVES = [{ from: toIsoDate(source.scheduledFor), to: NATIVE }];

  // The learner moved this real weekly mock one week later at a fundable pace. The lower-budget
  // replan below puts a boss on that native date, which then needs an internal mock relocation.
  await expect(
    changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: PRIOR_MOVES.map((move) => ({ ...move, kind: "moveWeeklyEvent" })),
        timeZone: "UTC",
      },
    }),
  ).resolves.toMatchObject({ status: "applied" });

  return { goal, native: NATIVE, plan, priorMoves: PRIOR_MOVES };
}

describe("an internally relocated mock through the learner's exported moves", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => vi.useRealTimers());

  it("keeps D→D' distinct from the learner's D'→E and undo, including immutable past funding", async () => {
    const { goal, native: NATIVE, plan, priorMoves: PRIOR_MOVES } = await setup();
    const initial = await readSaved(plan.id);
    const initialMock = mockOn(initial, NATIVE);

    expect(parsePlanSettings(initial.settings).mockFunding).toContainEqual(
      expect.objectContaining({ date: NATIVE, day: 1, fullLength: false, minutes: 165 }),
    );

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: initialMock.id }),
    ).resolves.toMatchObject({ challenge: { date: NATIVE, minutes: 165 }, status: "ready" });

    // This learner already studied the test-owned first two phases ahead of their planned dates.
    // Their held boss therefore has the same tested teaching when only the funding pace changes.
    await prisma.planItem.updateMany({
      data: { completedAt: new Date(`${START}T11:00:00Z`), status: "done" },
      where: { kind: { in: ["lesson", "chapter"] }, phase: { lte: 1 }, planId: plan.id },
    });

    // The actual saved window below shows whether the lower pace needs automatic relocation.
    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [{ kind: "setWeekdayMinutes", minutes: 11, weekdays: [1, 2, 3, 4, 5] }],
          timeZone: "UTC",
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const relocated = await readSaved(plan.id);
    const settings = parsePlanSettings(relocated.settings);

    // Protected teaching changes the phase calendar: the real coevent is the lowered-budget
    // first phase's boss, while the initial higher-budget mock was already funded on this date.
    const nativeBoss = relocated.items.find((item) => item.kind === "boss" && item.phase === 0);
    expect(nativeBoss).toMatchObject({ scheduledFor: new Date(NATIVE), status: "todo" });

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: nativeBoss?.id ?? "" }),
    ).resolves.toMatchObject({ challenge: { date: NATIVE, minutes: 15 }, status: "ready" });

    const relocation = settings.mockRelocations.find((entry) => entry.from === NATIVE);
    expect(relocation).toBeDefined();

    if (!relocation) {
      throw new Error("Expected the unfundable coevent's actual internal relocation");
    }

    const RELOCATED = relocation.to;
    const LEARNER_DAY = nextWeekday(RELOCATED);
    const actualMock = mockOn(relocated, RELOCATED);
    expect(PRIOR_MOVES).toStrictEqual([{ from: "2020-10-09", to: "2020-10-16" }]);
    expect(RELOCATED).toBe("2020-10-19");
    expect(LEARNER_DAY).toBe("2020-10-20");

    expect(settings.movedEvents).toStrictEqual(PRIOR_MOVES);
    expect(settings.mockRelocations).toStrictEqual([{ from: NATIVE, to: RELOCATED }]);

    expect(
      relocated.items.some(
        (item) => item.kind === "mock" && item.scheduledFor?.toISOString().slice(0, 10) === NATIVE,
      ),
    ).toBe(false);

    const funding = settings.mockFunding.find((entry) => entry.date === RELOCATED);
    expect(funding).toMatchObject({ day: 1, fullLength: false, minutes: 165 });
    expect(funding).not.toHaveProperty("fixedMinutes");

    const donated = funding?.contributions.reduce((total, entry) => total + entry.minutes, 0) ?? 0;
    const dayMinutes = settings.weekdayMinutes?.[fromIsoDate(RELOCATED).getUTCDay()] ?? 0;
    expect(donated).toBeLessThan(165);
    expect(165 - donated).toBeLessThanOrEqual(dayMinutes);
    expect(funding?.contributions).toHaveLength(14);
    expect(funding?.contributions.every((entry) => entry.minutes === 11)).toBe(true);
    expect(donated).toBe(154);
    expect(dayMinutes).toBe(11);

    expect(new Set(funding?.contributions.map((entry) => entry.date)).size).toBe(
      funding?.contributions.length,
    );

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: actualMock.id }),
    ).resolves.toMatchObject({
      challenge: { date: RELOCATED, fullLength: false, minutes: 165 },
      status: "ready",
    });

    const past = funding?.contributions.filter((entry) => entry.date < LATER_TODAY);
    expect(past).toStrictEqual([{ date: START, minutes: 11 }]);
    expect(past?.length).toBeGreaterThan(0);
    expect(past?.every((entry) => entry.minutes > 0)).toBe(true);

    // Real, test-owned prior lesson history keeps this date advance focused on funded identity,
    // rather than an unrelated missed-lesson replan. Funding is never written by the fixture.
    await prisma.planItem.updateMany({
      data: { completedAt: new Date(`${START}T18:00:00Z`), status: "done" },
      where: {
        kind: { in: ["lesson", "chapter"] },
        planId: plan.id,
        scheduledFor: { lt: new Date(LATER_TODAY) },
      },
    });

    vi.setSystemTime(new Date(`${LATER_TODAY}T12:00:00Z`));
    await refreshGoalPlan({ goalId: goal.id, pace: "saved" });
    const refreshed = await readSaved(plan.id);
    const refreshedSettings = parsePlanSettings(refreshed.settings);
    expect(mockOn(refreshed, RELOCATED).id).toBe(actualMock.id);

    expect(refreshedSettings.mockRelocations).toStrictEqual([{ from: NATIVE, to: RELOCATED }]);

    expect(parsePlanSettings(refreshed.settings).movedEvents).toStrictEqual(PRIOR_MOVES);

    expect(
      parsePlanSettings(refreshed.settings)
        .mockFunding.find((entry) => entry.date === RELOCATED)
        ?.contributions.filter((entry) => entry.date < LATER_TODAY),
    ).toStrictEqual(past);

    await expect(refreshGoalPlan({ goalId: goal.id, pace: "saved" })).resolves.toMatchObject({
      status: "unchanged",
    });

    await expect(readSaved(plan.id)).resolves.toStrictEqual(refreshed);

    const moved = await changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [{ from: RELOCATED, kind: "moveWeeklyEvent", to: LEARNER_DAY }],
        timeZone: "UTC",
      },
    });

    expect(moved).toMatchObject({ status: "applied" });

    if (moved.status !== "applied" || !moved.change) {
      throw new Error(`Expected the learner's move: ${moved.status}`);
    }

    expect(moved.change.effect?.nextMock).toStrictEqual({ after: LEARNER_DAY, before: RELOCATED });

    const learnerMoved = await readSaved(plan.id);
    const learnerSettings = parsePlanSettings(learnerMoved.settings);
    const learnerMock = mockOn(learnerMoved, LEARNER_DAY);

    expect(learnerSettings.movedEvents).toStrictEqual([
      ...PRIOR_MOVES,
      { from: RELOCATED, to: LEARNER_DAY },
    ]);

    expect(learnerSettings.mockFunding).toContainEqual(
      expect.objectContaining({ date: LEARNER_DAY, day: 1, fullLength: false, minutes: 165 }),
    );

    expect(
      learnerSettings.mockFunding
        .find((entry) => entry.date === LEARNER_DAY)
        ?.contributions.filter((entry) => entry.date < LATER_TODAY),
    ).toStrictEqual(past);

    expect(
      learnerMoved.items.some(
        (item) =>
          item.kind === "mock" && item.scheduledFor?.toISOString().slice(0, 10) === RELOCATED,
      ),
    ).toBe(false);

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: learnerMock.id }),
    ).resolves.toMatchObject({
      challenge: { date: LEARNER_DAY, fullLength: false, minutes: 165 },
      status: "ready",
    });

    await expect(
      decidePlanChange({
        changeId: moved.change.id,
        goalId: goal.id,
        input: { status: "undone", timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const undone = await readSaved(plan.id);
    const undoSettings = parsePlanSettings(undone.settings);
    const restoredMock = mockOn(undone, RELOCATED);
    expect(undoSettings.movedEvents).toStrictEqual(PRIOR_MOVES);
    expect(undoSettings.mockRelocations).toStrictEqual([{ from: NATIVE, to: RELOCATED }]);

    expect(undoSettings.mockFunding).toStrictEqual(refreshedSettings.mockFunding);
    expect(lessonAndBossFacts(undone)).toStrictEqual(lessonAndBossFacts(refreshed));

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: restoredMock.id }),
    ).resolves.toMatchObject({
      challenge: { date: RELOCATED, fullLength: false, minutes: 165 },
      status: "ready",
    });
  });
});
