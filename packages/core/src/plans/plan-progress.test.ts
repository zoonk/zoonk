import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoal } from "../goals/get-goal";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { getGoalPlan } from "./get-goal-plan";

describe("phase and Plan lesson scope", () => {
  it.each(["todo", "testedOut"] as const)(
    "counts a %s lesson whose skill comes from its content",
    async (status) => {
      const user = await userFixture();

      const { goal, plan, planItems, skills } = await learnerGoalFixture({
        phases: [2],
        userId: user.id,
      });

      const [done, linked] = planItems;

      await prisma.plan.update({
        data: {
          graph: {
            skills: skills.map((skill) => ({
              area: "Science",
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
            })),
          },
        },
        where: { id: plan.id },
      });

      await Promise.all([
        prisma.planItem.update({
          data: { chapterId: null, status: "done" },
          where: { id: done?.id },
        }),
        prisma.planItem.update({
          data: { chapterId: null, skillId: null, status },
          where: { id: linked?.id },
        }),
      ]);

      mockSession(user.id);

      const [view, syllabus, summary] = await Promise.all([
        getGoalPlan(goal.id),
        getSyllabusView({ goalId: goal.id }),
        getGoal(goal.id),
      ]);

      expect(syllabus).toMatchObject({
        status: "ready",
        syllabus: { lessons: { done: status === "todo" ? 1 : 2, total: 2 } },
      });

      expect(summary).toMatchObject({ goal: { plan: { lessonsTotal: 2 } }, status: "ready" });
      expect(view.status).toBe("ready");

      if (view.status !== "ready") {
        return;
      }

      expect(view.plan.phases.reduce((sum, phase) => sum + phase.lessonsTotal, 0)).toBe(2);

      expect(view.plan.phases.reduce((sum, phase) => sum + phase.lessonsDone, 0)).toBe(
        status === "todo" ? 1 : 2,
      );
    },
  );
});
