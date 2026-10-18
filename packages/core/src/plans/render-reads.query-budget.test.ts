import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { findCourseGoalStart } from "../goals/start-course-goal";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getGoalPlan } from "./get-goal-plan";
import { getPlanLink } from "./get-plan-link";

describe("supporting plan render read budgets", () => {
  it.each(["plan", "link", "course start"] as const)("reads %s", async (name) => {
    const { course, goal, plan } = await signedInCourseGoal();

    const readers = {
      "course start": () => findCourseGoalStart(course.id),
      link: () => getPlanLink(plan.id),
      plan: () => getGoalPlan(goal.id),
    };

    const counts = await countDatabaseStatements<unknown>(readers[name]);
    const budgets = { "course start": 10, link: 5, plan: 14 };
    assertReadBudget(counts, budgets[name]);

    expect(counts.result).toMatchObject(
      name === "course start" ? { goalId: goal.id } : { status: "ready" },
    );
  });
});
