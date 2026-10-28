import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadPlanAtToken } from "./_utils/plan-token";
import { prepareRetainedPlanWrite } from "./_utils/prepare-plan-write";
import { computePlan } from "./_utils/replan";
import { savePlanInputsKey } from "./_utils/write-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { addDays } from "./planner/plan-calendar";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const MONDAY = new Date("2020-09-28T00:00:00Z");

describe("what the plan view says it covers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // R25 (Câmara seed 2008): a session's run saved a plan that kept this week as it was, and the plan
  // view read it again planning this week anew, which kept a skill more, so the view said every
  // topic's core fits next to 12 topics out for time.
  it("never says every skill fits when the plan's week leaves one out for time", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 6,
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-02T00:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    // The run that saved the plan gave every day to Friday's date to the first skill, two lessons a
    // day: no time is left for the second one.
    const [first] = library.skills;
    await prisma.planItem.deleteMany({ where: { planId: plan.id } });

    await Promise.all(
      library.lessons
        .slice(0, 8)
        .map((lesson, index) =>
          planItemFixture({
            chapterId: library.chapters[0]?.id ?? null,
            facts: {
              minutes: 6,
              parts: { checkpoint: 0, practice: 3, unwritten: 0, written: 3 },
              schemaVersion: 1,
              skillIds: first ? [first.id] : [],
            },
            lessonId: lesson.id,
            minutes: 6,
            planId: plan.id,
            position: index,
            scheduledFor: addDays(MONDAY, Math.floor(index / 2)),
            skillId: first?.id ?? null,
            titleSnapshot: lesson.title,
          }),
        ),
    );

    const context = await loadPlanAtToken(goal.id);

    if (!context) {
      throw new Error("Expected the writer context");
    }

    const computed = await computePlan({ context, mode: "automatic", pace: "saved" });
    const retained = await prepareRetainedPlanWrite({ computed, context });
    await savePlanInputsKey({ context, ...retained });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { feasibility: { coreFits: false } },
      status: "ready",
    });
  });
});
