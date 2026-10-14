import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";

const START = "2020-09-28";

describe("funding only the exam work the saved plan retains", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => vi.useRealTimers());

  it("releases an omitted mock's savings and restores the short outline's real study capacity", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 9 }] });

    const setup = async (kind: "exam" | "learn") => {
      const fixture = await unplannedGoalFixture({
        dailyMinutes: 30,
        details: { placementDeclined: true },
        kind,
        settings: { startDate: START, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] },
        targetDate: null,
        timezone: "UTC",
        userId: user.id,
      });

      await createGoalPlan({ goalId: fixture.goal.id, graph: library.graph });
      return fixture;
    };

    const [exam, learn] = await Promise.all([setup("exam"), setup("learn")]);

    const [saved, examItems, learnItems] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { id: exam.plan.id } }),
      prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId: exam.plan.id } }),
      prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId: learn.plan.id } }),
    ]);

    // Both outlines finish before the first weekly event, so no mock can consume their time.
    expect(examItems.filter((item) => item.kind === "mock")).toStrictEqual([]);
    expect(learnItems.filter((item) => item.kind === "checkpoint")).toStrictEqual([]);
    expect(parsePlanSettings(saved.settings).mockFunding).toStrictEqual([]);

    const lessonDates = (items: typeof examItems) =>
      items
        .filter((item) => item.kind === "lesson")
        .map((item) => [item.lessonId, item.scheduledFor?.toISOString()]);

    expect(lessonDates(examItems)).toHaveLength(9);
    expect(lessonDates(examItems)).toStrictEqual(lessonDates(learnItems));

    mockSession(user.id);
    const result = await getGoalPlan(exam.goal.id);

    if (result.status !== "ready") {
      throw new Error("Expected the learner's saved exam plan");
    }

    expect(result.plan.fundedMocks).toStrictEqual([]);
    const today = result.plan.week.days.find((day) => day.date === START);
    expect(today).toMatchObject({ minutes: 30, mockFunding: null });
  });
});
