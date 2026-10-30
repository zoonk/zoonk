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

/** Waits for every start, so the outlines that did start count, then fails like the first that didn't. */
export async function startAll(starts: readonly Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(starts);

  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (failed) {
    throw failed.reason;
  }
}

/**
 * Ends the learner's ask once its preparation is done, failed or not, unless it started an outline
 * for a course the day needs. `run` records the courses whose outlines it started.
 */
export async function whileLessonsAsked<T>({
  goalId,
  lessonsAskedAt,
  run,
}: {
  goalId: string;
  lessonsAskedAt?: number | null;
  run: (started: string[]) => Promise<T>;
}): Promise<T> {
  const started: string[] = [];

  try {
    return await run(started);
  } finally {
    if (lessonsAskedAt) {
      await endLessonsAskStep({ askedAt: lessonsAskedAt, goalId, startedCourseIds: started });
    }
  }
}

export async function startOutlines({
  context,
  courses,
  firstSkillId,
  forGuest,
  started = [],
}: {
  context: GoalRunContext;
  courses: OutlineCourse[];
  firstSkillId: string | null;
  forGuest: boolean;
  started?: string[];
}) {
  await startAll(
    courses.map(async (course) => {
      await start(courseOutlineWorkflow, [
        {
          ...course,
          analytics: context.analytics,
          forGuest,
          waitedSkillId: firstSkillId ?? undefined,
        },
      ]);

      started.push(course.courseId);
    }),
  );
}

export async function outlinePlanAhead({
  context,
  forGuest,
  goalId,
  started,
}: {
  context: GoalRunContext;
  forGuest: boolean;
  goalId: string;
  started?: string[];
}) {
  const lookahead = await readGoalLookaheadStep(goalId);

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep({ days: lookahead.outlineDays, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  await startOutlines({ context, courses: needs, firstSkillId, forGuest, started });
}
