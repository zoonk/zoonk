import { prisma } from "@zoonk/db";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getWeeklyMockMinutes, listMockClocks } from "../exams/mocks/mock-plan";
import { getTodayView } from "../view-models/today/get-today-view";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { buildPlan } from "./planner/build-plan";
import { type PlanGraph, parsePlanSettings } from "./planner/plan-state";

const PRIOR_DAY = new Date("2026-10-13T12:00:00Z");
const NEXT_DAY = new Date("2026-10-14T12:00:00Z");

/** The actual previous-day Main fixture, including the planner's joined unwritten work. */
async function createPriorDayPlan() {
  const user = await userFixture();

  const [goal, skills] = await Promise.all([
    goalFixture({
      createdAt: PRIOR_DAY,
      dailyMinutes: 12,
      kind: "learn",
      targetDate: null,
      timezone: "UTC",
      userId: user.id,
    }),
    Promise.all([
      skillFixture({ name: "Opening the interview" }),
      skillFixture({ name: "Follow-up questions" }),
    ]),
  ]);

  const graph: PlanGraph = {
    phases: [
      { milestone: null, name: "First interviews" },
      { milestone: null, name: "Practice" },
    ],
    skills: skills.map((skill, index) => ({
      area: "Interviews",
      lessons: index === 0 ? 12 : 60,
      name: skill.name,
      phase: index,
      skillId: skill.id,
      weight: null,
    })),
  };

  // A saved plan keeps the pace it was built with; unrelated learners must not resample it.
  const pace = { factor: 1, source: "typical" as const };
  const settings = parsePlanSettings({ pace, startDate: "2026-10-13" });

  const built = buildPlan({
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure: null }),
    goal,
    graph,
    items: [],
    lessons: [],
    mockClocks: listMockClocks(null),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    mode: "forced",
    paceFactor: pace.factor,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today: new Date("2026-10-13T00:00:00Z"),
  });

  const plan = await planFixture({
    createdAt: PRIOR_DAY,
    goalId: goal.id,
    graph,
    phases: built.phases,
    settings: { ...settings, mockFunding: built.mockFunding },
  });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.planItem.createMany({
      data: built.items.map((item, position) => ({
        chapterId: item.chapterId,
        completedAt: item.completedAt,
        kind: item.kind,
        lessonId: item.lessonId,
        lessons: item.lessons,
        phase: item.phase,
        planId: plan.id,
        position,
        scheduledFor: item.scheduledFor,
        skillId: item.skillId,
        status: item.status,
        titleSnapshot: item.titleSnapshot,
      })),
    }),
  ]);

  return { built, goal, plan, user };
}

describe("mandatory phase notices after missed days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PRIOR_DAY);
  });

  afterEach(() => vi.useRealTimers());

  it("shows the saved applied phase move when ordinary Today settling has no behind choices", async () => {
    const { built, goal, plan, user } = await createPriorDayPlan();
    mockSession(user.id);

    expect(built.phases[0]?.endDate).toBe("2026-10-21");

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "lesson", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({
      lessonId: null,
      lessons: null,
      scheduledFor: new Date("2026-10-13T00:00:00Z"),
      status: "todo",
    });

    /** Match the reached calendar change without writing any applied notice or item date. */
    await prisma.plan.update({
      data: {
        settings: {
          ...parsePlanSettings(plan.settings),
          weekdayMinutes: Array.from({ length: 7 }, (_, day) => (day === 3 ? 0 : 12)),
        },
      },
      where: { id: plan.id },
    });

    const pending = await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ kind: "fitPhaseDates" }], source: "phaseDates" },
      planId: plan.id,
      status: "proposed",
    });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toBe(0);

    vi.setSystemTime(NEXT_DAY);

    /** The existing global harness replaces auth/cache only; this GET performs the real settle. */
    const result = await getTodayView({ goalId: goal.id, timeZone: "UTC" });
    expect(result.status).toBe("ready");

    const [changes, saved, replaced] = await Promise.all([
      prisma.planChange.findMany({ where: { planId: plan.id, status: "applied" } }),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.planChange.findUniqueOrThrow({ where: { id: pending.id } }),
    ]);

    expect(changes).toHaveLength(1);
    expect(replaced.status).toBe("replaced");

    const change = changes[0];

    if (!change || result.status !== "ready") {
      throw new Error("Ordinary Today settling must save one real applied change");
    }

    const payload = parsePlanChangePayload(change.payload);

    const phaseEnds = [{ after: "2026-10-24", before: "2026-10-21", name: "First interviews" }];

    expect(change.kind).toBe("missedDays");

    expect(payload).toMatchObject({
      behind: null,
      days: 1,
      effect: { lessonsAdded: 0, lessonsRemoved: 0 },
      source: "system",
    });

    expect(payload.effect?.phaseEnds).toStrictEqual(phaseEnds);

    expect(saved.phases).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ endDate: "2026-10-24", name: "First interviews" }),
      ]),
    );

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "boss", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({ scheduledFor: new Date("2026-10-24T00:00:00Z") });

    expect(result.today.planChange).toMatchObject({
      behind: null,
      canUndo: false,
      effect: { phaseEnds },
      id: change.id,
      kind: "missedDays",
      source: "system",
      status: "applied",
    });

    expect(result.today.planChange?.effect).toStrictEqual(payload.effect);
  });
});
