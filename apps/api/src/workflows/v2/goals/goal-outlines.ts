import { type CourseBandNeed, type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { OUTLINE_SOON_DAYS } from "@zoonk/core/lookahead/outline-ahead";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { type GoalRunContext } from "./goal-run-context";
import {
  endLessonsAskStep,
  listPlanOutlineNeedsStep,
  listSkillExtensionsStep,
  listSoonStandInCourseIdsStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";

type OutlineCourse = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

type PlanOutline = OutlineCourse & { background: boolean; waitedSkillId?: string };

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

function getOutlineWait({
  courseId,
  firstSkillId,
  soonCourseIds,
}: {
  courseId: string;
  firstSkillId: string | null;
  soonCourseIds: ReadonlySet<string>;
}): { background: boolean; waitedSkillId?: string } {
  if (!soonCourseIds.has(courseId)) {
    return { background: true };
  }

  return firstSkillId ? { background: false, waitedSkillId: firstSkillId } : { background: false };
}

function mergeCourseRequests(requests: readonly OutlineCourse[]): OutlineCourse[] {
  return [...Map.groupBy(requests, (request) => request.courseId).values()].flatMap(
    ([first, ...rest]) =>
      first ? [{ ...first, bands: [...first.bands, ...rest.flatMap((item) => item.bands)] }] : [],
  );
}

/** Untaught bands and partly written topics' next chapters the plan reaches within `days`; only today's are written in the foreground. */
export async function listPlanOutlines({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<PlanOutline[]> {
  const [extensions, needs, soon, firstSkillId] = await Promise.all([
    listSkillExtensionsStep({ days, goalId }),
    listPlanOutlineNeedsStep({ days, goalId }),
    listSoonStandInCourseIdsStep({ days: OUTLINE_SOON_DAYS, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  const soonCourseIds = new Set(soon);

  return mergeCourseRequests([...extensions, ...needs]).map((course) => ({
    ...course,
    ...getOutlineWait({ courseId: course.courseId, firstSkillId, soonCourseIds }),
  }));
}

export async function startPlanOutline({
  analytics,
  forGuest,
  outline,
  started,
}: {
  analytics: ContentAnalytics;
  forGuest?: boolean;
  outline: PlanOutline;
  started: string[];
}) {
  await start(courseOutlineWorkflow, [{ ...outline, analytics, forGuest }]);
  started.push(outline.courseId);
}
