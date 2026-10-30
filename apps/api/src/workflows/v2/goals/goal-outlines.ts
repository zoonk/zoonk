import { type CourseBandNeed, type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { start } from "workflow/api";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { type GoalRunContext } from "./goal-run-context";
import {
  endLessonsAskStep,
  listPlanOutlineNeedsStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";

type OutlineCourse = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

export async function startOutlines({
  context,
  courses,
  firstSkillId,
  forGuest,
}: {
  context: GoalRunContext;
  courses: OutlineCourse[];
  firstSkillId: string | null;
  forGuest: boolean;
}) {
  await Promise.all(
    courses.map((course) =>
      start(courseOutlineWorkflow, [
        {
          ...course,
          analytics: context.analytics,
          forGuest,
          waitedSkillId: firstSkillId ?? undefined,
        },
      ]),
    ),
  );
}

export async function outlinePlanAhead({
  context,
  forGuest,
  goalId,
  lessonsAskedAt,
}: {
  context: GoalRunContext;
  forGuest: boolean;
  goalId: string;
  lessonsAskedAt?: number | null;
}) {
  const lookahead = await readGoalLookaheadStep(goalId);

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep({ days: lookahead.outlineDays, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  await startOutlines({ context, courses: needs, firstSkillId, forGuest });

  if (lessonsAskedAt) {
    await endLessonsAskStep({
      askedAt: lessonsAskedAt,
      goalId,
      startedCourseIds: needs.map((need) => need.courseId),
    });
  }
}
