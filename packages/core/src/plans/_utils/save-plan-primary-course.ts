import "server-only";
import { DbNull, type Goal, type TransactionClient } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { courseContentLanguage } from "../../courses/_utils/course-edition-family";
import { unpinnedCourseSourceId } from "../../goals/course-start-details";
import { getSinglePlanCourseId } from "../../library/curriculum/goal-plan-graph";
import { type PlanGraph } from "../planner/plan-state";

function getPreviousCourseId(goal: Goal): string | null {
  const openingCourse = isJsonObject(goal.openingSkill) ? goal.openingSkill.course : null;
  return goal.primaryCourseId ?? getString(openingCourse, "id");
}

async function getLocalizedCourseGoalName({
  courseId,
  goal,
  graph,
  tx,
}: {
  courseId: string | null;
  goal: Goal;
  graph: PlanGraph;
  tx: TransactionClient;
}) {
  const sourceId = unpinnedCourseSourceId(goal);

  if (
    !sourceId ||
    !courseId ||
    courseId === sourceId ||
    getSinglePlanCourseId(graph) !== courseId
  ) {
    return null;
  }

  // The plan write holds the learner lock. Read the current name in case the learner renamed it while planning.
  const [course, current] = await Promise.all([
    tx.course.findUnique({ select: { language: true, title: true }, where: { id: courseId } }),
    tx.goal.findUniqueOrThrow({
      select: { displayName: true, prompt: true, title: true },
      where: { id: goal.id },
    }),
  ]);

  if (
    !course ||
    course.title === current.title ||
    current.title !== current.prompt ||
    courseContentLanguage(course.language) !== courseContentLanguage(goal.language)
  ) {
    return null;
  }

  return {
    displayName: current.displayName === current.prompt ? course.title : undefined,
    title: course.title,
  };
}

export async function savePlanPrimaryCourse({
  goal,
  graph,
  isFirst,
  primaryCourseId,
  tx,
}: {
  goal: Goal;
  graph: PlanGraph;
  isFirst: boolean;
  primaryCourseId?: string;
  tx: TransactionClient;
}): Promise<void> {
  const localizedName = await getLocalizedCourseGoalName({
    courseId: primaryCourseId ?? goal.primaryCourseId,
    goal,
    graph,
    tx,
  });

  const changesCourse = primaryCourseId && primaryCourseId !== goal.primaryCourseId;

  if (changesCourse || localizedName) {
    await tx.goal.update({
      data: {
        ...localizedName,
        ...(changesCourse && { primaryCourseId }),
        ...(changesCourse &&
          !isFirst &&
          primaryCourseId !== getPreviousCourseId(goal) && {
            details: isJsonObject(goal.details)
              ? Object.fromEntries(
                  Object.entries(goal.details).filter(([key]) => key !== "courseStart"),
                )
              : undefined,
            openingLessonId: null,
            openingSkill: DbNull,
            warmUpId: null,
          }),
      },
      where: { id: goal.id },
    });
  }
}
