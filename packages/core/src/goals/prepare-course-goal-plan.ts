import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { loadCourseExam } from "./_utils/course-exam";
import { loadCourseOutline, plansFromCourseOutline } from "./_utils/course-outline";
import { toCoursePlanGraph } from "./_utils/course-plan-graph";
import { readCourseStart } from "./course-start-details";

/** Workflow bridge: the goal must come from the learner's authorized run. */
export async function prepareCourseGoalPlan({
  goalId,
  platform = null,
}: {
  goalId: string;
  platform?: AnalyticsPlatform | null;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  const start = goal && isJsonObject(goal.details) ? readCourseStart(goal.details) : null;

  if (!goal || !start || !goal.primaryCourseId) {
    return;
  }

  const [course, plan] = await Promise.all([
    prisma.course.findUnique({ omit: { landingPage: true }, where: { id: goal.primaryCourseId } }),
    prisma.plan.findUnique({ where: { goalId } }),
  ]);

  if (!course || parsePlanGraph(plan?.graph).skills.length > 0) {
    return;
  }

  const [outline, exam] = await Promise.all([
    loadCourseOutline({ courseId: course.id, userId: goal.userId }),
    loadCourseExam(course.id),
  ]);

  if (
    !plansFromCourseOutline({
      chapterId: start.chapterId,
      chapters: outline,
      courseFormat: course.format,
      courseId: course.id,
      examGraph: exam?.graph ?? null,
      outlineStatus: course.outlineStatus,
    })
  ) {
    return;
  }

  const graph = toCoursePlanGraph({
    chapters: outline,
    course,
    examGraph: exam?.graph,
    startChapterId: start.chapterId,
  });

  if (graph.skills.length > 0 || exam) {
    await createGoalPlan({ goalId, graph, platform });
  }
}
