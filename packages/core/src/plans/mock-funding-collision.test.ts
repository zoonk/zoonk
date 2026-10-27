import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { toIsoDate } from "./planner/plan-calendar";

const START = "2020-09-28";
const STUDY_MINUTES = 180;
const LESSON_MINUTES = 60;

describe("mock move collisions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => vi.useRealTimers());

  it("refuses to move a mock onto another retained mock without changing either funded event", async () => {
    const structure = examStructureSchema.parse({
      formats: [],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "Each correct answer earns one point", method: "raw" },
        sections: [{ day: 1, kind: "objective", minutes: 330, name: "Math", questions: 60 }],
        timeLimitMinutes: 330,
        totalQuestions: 60,
      },
      rules: [],
      subjects: [],
    });

    const [user, blueprint, library] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure }),
      planLibraryFixture({ skills: [{ area: "Math", lessons: 60 }] }),
    ]);

    await prisma.lesson.updateMany({
      data: { estimatedMinutes: LESSON_MINUTES },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    });

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: new Date(START),
      dailyMinutes: STUDY_MINUTES,
      details: { placementDeclined: true },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: {
        startDate: START,
        weekdayMinutes: Array.from({ length: 7 }, () => STUDY_MINUTES),
      },
      targetDate: null,
      timezone: "UTC",
      userId: user.id,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
      status: "created",
    });

    // Only request authentication is doubled; creation, the move and persistence use PostgreSQL.
    mockSession(user.id);

    const readPlan = () =>
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      });

    const before = await readPlan();
    const beforeGoal = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    const mocks = before.items.filter((item) => item.kind === "mock" && item.status === "todo");
    const first = mocks[0];
    const second = mocks[1];

    expect(first?.scheduledFor).toStrictEqual(new Date("2020-10-11"));
    expect(second?.scheduledFor).toStrictEqual(new Date("2020-10-18"));

    if (!first?.scheduledFor || !second?.scheduledFor) {
      throw new Error("Expected two real retained weekly mocks");
    }

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [
          {
            from: toIsoDate(first.scheduledFor),
            kind: "moveWeeklyEvent",
            to: toIsoDate(second.scheduledFor),
          },
        ],
        timeZone: "UTC",
      },
    });

    expect(result).toStrictEqual({ error: "mockCollision", status: "invalid" });
    await expect(readPlan()).resolves.toStrictEqual(before);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toStrictEqual(
      beforeGoal,
    );

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });
});
