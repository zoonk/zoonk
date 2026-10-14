import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  NUMBERS_DAYS,
  NUMBERS_NOW,
  estimateNumbersFixture,
} from "../catalog/_test-utils/estimate-numbers-fixture";
import { loadCourseEstimateData } from "../catalog/_utils/course-estimate-data";
import { startCourseGoal } from "../goals/start-course-goal";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { getPlanTimeAdvice } from "./get-time-advice";
import { endNoticeWait } from "./notice-wait";
import { parsePlanSettings } from "./planner/plan-state";

describe("learner plan numbers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NUMBERS_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("separates work after the exam from the days and available time before it", async () => {
    const [{ course }, user] = await Promise.all([estimateNumbersFixture(), userFixture()]);
    mockSession(user.id);

    const started = await startCourseGoal({
      courseId: course.id,
      input: {
        dailyMinutes: 30,
        level: "basic",
        studyDays: NUMBERS_DAYS,
        targetDate: "2020-10-23",
        timeZone: "UTC",
      },
    });

    if (started.status !== "created") {
      throw new Error("Expected course start");
    }

    const data = await loadCourseEstimateData(course.id, "2020-09-28");

    if (!data) {
      throw new Error("Expected reused curriculum");
    }

    await createGoalPlan({ goalId: started.goal.id, graph: data.sourceGraph });
    await endNoticeWait(started.goal.id);

    const changed = await changeGoalPlan({
      goalId: started.goal.id,
      input: { operations: [{ fullCourse: true, kind: "setFullCourse" }], timeZone: "UTC" },
    });

    expect(changed.status).toBe("applied");

    const [result, advice] = await Promise.all([
      getGoalPlan(started.goal.id),
      getPlanTimeAdvice({
        goalId: started.goal.id,
        input: { dailyMinutes: 30, studyDays: NUMBERS_DAYS },
      }),
    ]);

    if (result.status !== "ready" || advice.status !== "ready") {
      throw new Error("Expected plan and advice");
    }

    expect(result.plan.numbers).not.toBeNull();
    const numbers = result.plan.numbers!;
    expect(numbers.afterDeadlineMinutes).toBeGreaterThan(0);

    expect(numbers.scheduledMinutes).toBeCloseTo(
      numbers.beforeDeadlineMinutes! + numbers.afterDeadlineMinutes!,
      1,
    );

    expect(numbers.studyDaysBeforeDeadline).toBe(19);

    expect(numbers.availableBeforeDeadlineMinutes).toBeLessThanOrEqual(
      19 * 30 + numbers.milestoneExtraMinutesBeforeDeadline!,
    );

    expect(numbers.beforeDeadlineMinutes).toBeLessThanOrEqual(
      numbers.availableBeforeDeadlineMinutes!,
    );

    expect(advice.advice.numbers).toStrictEqual(numbers);
    expect(advice.advice.coveredShare).toBe(numbers.coverage?.coveredShare);
    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: started.goal.id } });
    expect(saved.dailyMinutes).toBe(30);
  });

  it.each([10, 15, 30])(
    "counts actual small-milestone excess in the %s-minute calendar",
    async (dailyMinutes) => {
      const user = await userFixture();

      const library = await planLibraryFixture({
        phases: ["First", "Second"],
        skills: [
          { lessons: 5, phase: 0 },
          { lessons: 4, phase: 1 },
        ],
      });

      const { goal } = await unplannedGoalFixture({
        dailyMinutes,
        settings: {
          startDate: "2020-09-28",
          weekdayMinutes: [
            0,
            dailyMinutes,
            dailyMinutes,
            dailyMinutes,
            dailyMinutes,
            dailyMinutes,
            0,
          ],
        },
        targetDate: new Date("2020-10-23T00:00:00Z"),
        userId: user.id,
      });

      mockSession(user.id);
      await createGoalPlan({ goalId: goal.id, graph: library.graph });

      const [result, stored] = await Promise.all([
        getGoalPlan(goal.id),
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ]);

      if (result.status !== "ready" || !result.plan.numbers) {
        throw new Error("Expected planned numbers");
      }

      const numbers = result.plan.numbers;

      const extra = parsePlanSettings(stored.settings).checkpointOverflow.reduce(
        (sum, entry) => sum + entry.minutes,
        0,
      );

      expect(numbers.milestoneExtraMinutesBeforeDeadline).toBe(extra);
      expect(numbers.availableBeforeDeadlineMinutes).toBe(19 * dailyMinutes + extra);

      expect(numbers.scheduledMinutes).toBe(
        Object.values(numbers.workload).reduce((sum, minutes) => sum + minutes, 0),
      );

      expect(numbers.beforeDeadlineMinutes).toBeLessThanOrEqual(
        numbers.availableBeforeDeadlineMinutes!,
      );

      expect(dailyMinutes === 10 ? extra > 0 : extra === 0).toBe(true);
    },
  );
});
