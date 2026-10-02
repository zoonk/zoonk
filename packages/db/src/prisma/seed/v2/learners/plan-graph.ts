import { type Prisma } from "../../../../generated/prisma/client";
import { listGoalSkills } from "./plan-schedule";
import { type SeedGoal } from "./types";
import { type LearnerScope } from "./write-goal";

/**
 * The skill graph the planner plans from, read back from the seeded plan: each skill in plan
 * order with its phase, its size in lessons, its area (an exam's area, or the course, as graphs
 * made from courses name it) and, for exams, its weight.
 */
export function buildPlanGraph(scope: LearnerScope, goal: SeedGoal): Prisma.InputJsonObject {
  const { lookup } = scope;

  return {
    phases: goal.plan.phases.map((phase) => ({
      milestone: phase.milestone ?? null,
      name: phase.name,
    })),
    skills: listGoalSkills(goal).map((skill) => {
      const lesson = lookup.lesson(skill.lesson);
      const chapter = lesson.chapterKey ? lookup.chapter(lesson.chapterKey) : null;

      return {
        area: chapter?.area ?? lookup.courseTitle,
        lessons: skill.lessons,
        name: lookup.skillName(skill.key),
        phase: skill.phase,
        skillId: lookup.skill(skill.key),
        weight: chapter?.weight ?? null,
      };
    }),
  };
}
