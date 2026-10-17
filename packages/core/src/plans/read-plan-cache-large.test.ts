import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { planCacheKey } from "./_test-utils/plan-cache-platform";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { readBuiltPlan } from "./_utils/read-built-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlanScreen } from "./get-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";

// Only the framework leaf is observed; the large input comes from the real persisted plan.
vi.mock("./_utils/read-built-plan", async (importOriginal) => {
  const actual = await importOriginal<{ readBuiltPlan: typeof readBuiltPlan }>();
  return { ...actual, readBuiltPlan: vi.fn(actual.readBuiltPlan) };
});

const NOW = new Date("2026-10-14T12:00:00Z");

describe("large real planning cache inputs", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("keeps a real large undated funded exam serializable and stable without rewriting its ledger", async () => {
    const [user, library, blueprint] = await Promise.all([
      userFixture(),
      planLibraryFixture({
        phases: ["Written foundations", "The remaining curriculum"],
        skills: [
          { area: "Math", lessons: 150 },
          { area: "Math", lessons: 0, phase: 1, size: 2000 },
        ],
      }),
      examBlueprintFixture({
        structure: examStructureSchema.parse({
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
        }),
      }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: NOW,
      dailyMinutes: 45,
      details: { placementDeclined: true },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: {
        pace: { factor: 1, source: "typical" },
        startDate: "2026-10-14",
        weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
      },
      targetDate: null,
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
      status: "created",
    });

    const saved = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    const funding = parsePlanSettings(saved.settings).mockFunding;
    expect(funding.length).toBeGreaterThan(0);
    expect(saved.items.some((item) => item.kind === "mock" && item.status === "todo")).toBe(true);
    expect(funding.every((entry) => entry.minutes === 165)).toBe(true);
    vi.mocked(readBuiltPlan).mockClear();

    const first = await getGoalPlanScreen(goal.id);
    const args = vi.mocked(readBuiltPlan).mock.calls.at(-1)?.[0];

    if (!args) {
      throw new Error("The exported large Plan must load its real fresh cache inputs");
    }

    expect(args.input.lessons).toHaveLength(150);
    expect(args.input.goal.targetDate).toBeNull();
    expect(args.input.graph.skills.some((skill) => skill.lessons === 2000)).toBe(true);
    expect(args.input.settings.mockFunding).toStrictEqual(funding);
    const key = await planCacheKey(["large-owned-plan", [args], ""]);
    await expect(getGoalPlanScreen(goal.id)).resolves.toStrictEqual(first);
    const again = vi.mocked(readBuiltPlan).mock.calls.at(-1)?.[0];
    await expect(planCacheKey(["large-owned-plan", [again], ""])).resolves.toBe(key);

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      }),
    ).resolves.toStrictEqual(saved);
  });
});
