import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { changeMockSchedule, getMockSchedule, undoMockSchedule } from "./mock-schedule";

const TIME_ZONE = "America/Sao_Paulo";
const TARGET_DATE = new Date("2020-12-11");

/** Two exam days, so each mock's paper differs from its neighbors' and a mix-up would show. */
const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "One point per correct answer", method: "raw" },
    sections: [
      { day: 1, kind: "objective", minutes: 120, name: "Math", questions: 30 },
      { day: 2, kind: "objective", minutes: 90, name: "Science", questions: 20 },
    ],
    timeLimitMinutes: 210,
    totalQuestions: 50,
  },
  rules: [],
  subjects: [],
});

async function setup() {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
    planLibraryFixture({
      skills: [
        { area: "Math", lessons: 30 },
        { area: "Science", lessons: 10 },
      ],
    }),
  ]);

  const [{ goal }] = await Promise.all([
    unplannedGoalFixture({
      dailyMinutes: 30,
      details: { placementDeclined: true },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: TARGET_DATE,
      timezone: TIME_ZONE,
      userId: user.id,
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  return goal.id;
}

async function openMockDay() {
  const goalId = await setup();
  vi.setSystemTime(new Date("2020-10-11T14:00:00Z"));
  await getTodayStudySession({ goalId, timeZone: TIME_ZONE });

  const item = await prisma.planItem.findFirstOrThrow({
    where: { kind: "mock", plan: { goalId }, scheduledFor: new Date("2020-10-11"), status: "todo" },
  });

  const block = await prisma.studySessionBlock.findFirstOrThrow({
    where: { payload: { equals: item.id, path: ["planItemId"] }, session: { goalId } },
  });

  return { block, item };
}

describe("scheduled mock changes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves one funded mock twice, skips it, and restores the second date", async () => {
    const goalId = await setup();

    const original = await prisma.planItem.findFirstOrThrow({
      where: { kind: "mock", plan: { goalId }, scheduledFor: new Date("2020-10-11") },
    });

    const get = (planItemId: string) => getMockSchedule({ planItemId, timeZone: TIME_ZONE });

    const change = (planItemId: string, date: string | null) =>
      changeMockSchedule({ input: { date, timeZone: TIME_ZONE }, planItemId });

    const others = async (except: string) => {
      const mocks = await prisma.planItem.findMany({
        orderBy: { scheduledFor: "asc" },
        where: { id: { not: except }, kind: "mock", planId: original.planId, status: "todo" },
      });

      return mocks.map((item) => item.scheduledFor?.toISOString());
    };

    const fundingOn = async (date: string) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { id: original.planId } });
      return parsePlanSettings(plan.settings).mockFunding.find((entry) => entry.date === date);
    };

    const paper = await fundingOn("2020-10-11");
    expect(paper?.day).toBeDefined();
    const identity = { day: paper?.day, fullLength: paper?.fullLength, minutes: paper?.minutes };
    const before = await others(original.id);

    await prisma.goal.update({ data: { targetDate: null }, where: { id: goalId } });

    await expect(get(original.id)).resolves.toMatchObject({
      dates: expect.arrayContaining(["2020-10-12"]),
      status: "ready",
    });

    await prisma.goal.update({ data: { targetDate: TARGET_DATE }, where: { id: goalId } });
    const options = await get(original.id);

    expect(options).toMatchObject({
      dates: expect.arrayContaining(["2020-10-12", "2020-10-13"]),
      status: "ready",
    });

    await expect(change(original.id, "2020-10-11")).resolves.toStrictEqual({
      status: "notMovable",
    });

    const first = await change(original.id, "2020-10-12");
    expect(first.status).toBe("changed");

    if (first.status !== "changed") {
      return;
    }

    await expect(fundingOn("2020-10-12")).resolves.toMatchObject(identity);
    await expect(others(first.planItemId)).resolves.toStrictEqual(before);
    const second = await change(first.planItemId, "2020-10-13");
    expect(second.status).toBe("changed");

    if (second.status !== "changed") {
      return;
    }

    await expect(others(second.planItemId)).resolves.toStrictEqual(before);
    await expect(fundingOn("2020-10-13")).resolves.toMatchObject(identity);
    const skipped = await change(second.planItemId, null);
    expect(skipped.status).toBe("changed");

    if (skipped.status !== "changed") {
      return;
    }

    await expect(others(second.planItemId)).resolves.toStrictEqual(before);

    await expect(
      prisma.planItem.count({
        where: {
          kind: "mock",
          planId: original.planId,
          scheduledFor: new Date("2020-10-13"),
          status: "todo",
        },
      }),
    ).resolves.toBe(0);

    await expect(
      undoMockSchedule({
        changeId: skipped.changeId,
        planItemId: original.id,
        timeZone: TIME_ZONE,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      undoMockSchedule({
        changeId: skipped.changeId,
        planItemId: second.planItemId,
        timeZone: TIME_ZONE,
      }),
    ).resolves.toStrictEqual({ status: "undone" });

    await expect(
      prisma.planItem.findFirst({
        where: {
          kind: "mock",
          planId: original.planId,
          scheduledFor: new Date("2020-10-13"),
          status: "todo",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("accepts a later mock's vacated date when it is offered for the preceding mock", async () => {
    const goalId = await setup();

    const [first, second] = await prisma.planItem.findMany({
      orderBy: { scheduledFor: "asc" },
      take: 2,
      where: {
        kind: "mock",
        plan: { goalId },
        scheduledFor: { gte: new Date("2020-10-11") },
        status: "todo",
      },
    });

    if (!first || !second?.scheduledFor) {
      throw new Error("Expected two scheduled mocks");
    }

    const options = await getMockSchedule({ planItemId: second.id, timeZone: TIME_ZONE });

    if (options.status !== "ready" || !options.dates[0]) {
      throw new Error("Expected a later date");
    }

    await expect(
      changeMockSchedule({
        input: { date: options.dates[0], timeZone: TIME_ZONE },
        planItemId: second.id,
      }),
    ).resolves.toMatchObject({ status: "changed" });

    const earlier = await prisma.planItem.findFirstOrThrow({
      where: {
        kind: "mock",
        planId: first.planId,
        scheduledFor: first.scheduledFor,
        status: "todo",
      },
    });

    const date = second.scheduledFor.toISOString().slice(0, 10);

    await expect(
      getMockSchedule({ planItemId: earlier.id, timeZone: TIME_ZONE }),
    ).resolves.toMatchObject({ dates: expect.arrayContaining([date]) });

    await expect(
      changeMockSchedule({ input: { date, timeZone: TIME_ZONE }, planItemId: earlier.id }),
    ).resolves.toMatchObject({ status: "changed" });
  });

  it("preserves yesterday's saved block through skipping and undoing an overdue mock", async () => {
    const { item, block } = await openMockDay();
    vi.setSystemTime(new Date("2020-10-12T14:00:00Z"));

    await expect(
      getMockSchedule({ planItemId: item.id, timeZone: TIME_ZONE }),
    ).resolves.toMatchObject({ dates: expect.arrayContaining(["2020-10-13"]), status: "ready" });

    const overdue = await changeMockSchedule({
      input: { date: null, timeZone: TIME_ZONE },
      planItemId: item.id,
    });

    expect(overdue.status).toBe("changed");

    if (overdue.status !== "changed") {
      return;
    }

    await expect(
      undoMockSchedule({ changeId: overdue.changeId, planItemId: item.id, timeZone: TIME_ZONE }),
    ).resolves.toStrictEqual({ status: "undone" });

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("removes an unstarted mock from today's saved session atomically, restores it, and refuses a started block", async () => {
    const { item, block } = await openMockDay();

    const result = await changeMockSchedule({
      input: { date: null, timeZone: TIME_ZONE },
      planItemId: item.id,
    });

    expect(result.status).toBe("changed");

    if (result.status !== "changed") {
      return;
    }

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toBeNull();

    await expect(
      undoMockSchedule({ changeId: result.changeId, planItemId: item.id, timeZone: TIME_ZONE }),
    ).resolves.toStrictEqual({ status: "undone" });

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await prisma.studySessionBlock.update({
      data: { startedAt: new Date(), status: "active" },
      where: { id: block.id },
    });

    await expect(
      changeMockSchedule({ input: { date: null, timeZone: TIME_ZONE }, planItemId: item.id }),
    ).resolves.toStrictEqual({ status: "notMovable" });
  });
});
