import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/v2/plans/routine-fit";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** The model call is the one external boundary; each test says what the model understood. */
vi.mock("@zoonk/ai/tasks/v2/plans/routine-fit", () => ({ fitPlanToRoutineFacts: vi.fn() }));

/** A Monday in 2020, before other tests' learning events, so pace estimates don't move dates. */
const NOW = new Date("2020-09-28T12:00:00Z");

function mockFit(data: Awaited<ReturnType<typeof fitPlanToRoutineFacts>>["data"]) {
  vi.mocked(fitPlanToRoutineFacts).mockResolvedValue({
    data,
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "google/gemini-3.5-flash-lite",
      promptVersion: "test",
      provider: "google",
      requestedModel: "google/gemini-3.5-flash-lite",
      runId: "run-routine",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function learnerFixture({ memoryEnabled = true }: { memoryEnabled?: boolean } = {}) {
  const user = await userFixture();
  await learningProfileFixture({ memoryEnabled, userId: user.id });
  return user;
}

/** A learner with facts in every category, and a goal whose plan the planner hasn't built yet. */
async function setup({ settings = {} }: { settings?: object } = {}) {
  const user = await learnerFixture();

  const [library, goal] = await Promise.all([
    planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] }),
    unplannedGoalFixture({
      dailyMinutes: 20,
      settings: { startDate: "2020-09-28", ...settings },
      userId: user.id,
    }),
    memoryFactFixture({
      category: "routine",
      statement: "Never studies on Sundays",
      userId: user.id,
    }),
    memoryFactFixture({ category: "goals", statement: "Wants to finish by June", userId: user.id }),
    memoryFactFixture({ category: "background", statement: "Works as a nurse", userId: user.id }),
  ]);

  mockSession(user.id);
  return { ...goal, library, user };
}

describe("plans read the learner's goals and routine", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(fitPlanToRoutineFacts).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fits a new plan's week to the routine, with the reason and an undo", async () => {
    const { goal, library, plan } = await setup();

    mockFit({
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
      reason: "Sundays are off, since you never study then.",
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    expect(vi.mocked(fitPlanToRoutineFacts)).toHaveBeenCalledWith(
      expect.objectContaining({
        memory: expect.arrayContaining(["Never studies on Sundays", "Wants to finish by June"]),
      }),
    );

    const call = vi.mocked(fitPlanToRoutineFacts).mock.calls[0]?.[0];
    expect(call?.memory).not.toContain("Works as a nurse");

    const [stored, storedGoal, change] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.planChange.findFirstOrThrow({ where: { planId: plan.id } }),
    ]);

    expect(stored.settings).toMatchObject({ weekdayMinutes: [0, 20, 20, 20, 20, 20, 20] });
    expect(storedGoal.dailyMinutes).toBe(20);

    expect(change).toMatchObject({
      reason: "Sundays are off, since you never study then.",
      runId: "run-routine",
      status: "applied",
    });
  });

  it("leaves a plan alone when the learner already shaped their week", async () => {
    const { goal, library } = await setup({
      settings: { weekdayMinutes: [20, 20, 20, 20, 20, 20, 0] },
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    expect(vi.mocked(fitPlanToRoutineFacts)).not.toHaveBeenCalled();
  });

  it("asks nothing when memory has no goals or routine, or is turned off", async () => {
    const [withoutRoutine, memoryOff] = await Promise.all([
      learnerFixture(),
      learnerFixture({ memoryEnabled: false }),
    ]);

    const [library, first, second] = await Promise.all([
      planLibraryFixture({ skills: [{ lessons: 2 }] }),
      unplannedGoalFixture({ settings: { startDate: "2020-09-28" }, userId: withoutRoutine.id }),
      unplannedGoalFixture({ settings: { startDate: "2020-09-28" }, userId: memoryOff.id }),
      memoryFactFixture({
        category: "background",
        statement: "Lives in Recife",
        userId: withoutRoutine.id,
      }),
      memoryFactFixture({
        category: "routine",
        statement: "Never on Sundays",
        userId: memoryOff.id,
      }),
    ]);

    await createGoalPlan({ goalId: first.goal.id, graph: library.graph });
    await createGoalPlan({ goalId: second.goal.id, graph: library.graph });

    expect(vi.mocked(fitPlanToRoutineFacts)).not.toHaveBeenCalled();
  });
});
