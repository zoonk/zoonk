import { type CourseBandNeed, type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type OutlineAsk } from "@zoonk/core/lookahead/today-outlines";
import { start } from "workflow/api";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { type GoalRunContext } from "./goal-run-context";
import {
  listPlanOutlineNeedsStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
  settleOutlineAsksStep,
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

export async function settleOutlines({
  asked,
  started,
}: {
  asked: OutlineAsk[];
  started: string[];
}): Promise<void> {
  if (asked.length === 0 && started.length === 0) {
    return;
  }

  await settleOutlineAsksStep({ asked, started });
}

export async function outlinePlanAhead({
  asked = [],
  context,
  forGuest,
  goalId,
}: {
  asked?: OutlineAsk[];
  context: GoalRunContext;
  forGuest: boolean;
  goalId: string;
}) {
  const lookahead = await readGoalLookaheadStep(goalId);

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep({ days: lookahead.outlineDays, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  await settleOutlines({ asked, started: needs.map((need) => need.courseId) });
  await startOutlines({ context, courses: needs, firstSkillId, forGuest });
}
