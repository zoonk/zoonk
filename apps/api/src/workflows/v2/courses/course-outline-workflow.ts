import {
  type CourseBandNeed,
  type CurriculumScope,
  joinLevelBands,
} from "@zoonk/core/library/curriculum/scope";
import { safeAsync } from "@zoonk/utils/error";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { claimCourseWhenFree } from "./claim-course-when-free";
import { courseIconWorkflow } from "./course-details-workflow";
import { startCourseDetailsRun } from "./start-course-details-run";
import { type BandPlan } from "./steps/band-outline";
import {
  finishCourseOutlineStep,
  listWaitingGoalsStep,
  logReplanFailureStep,
  placeContinuationsStep,
  planOutlineBandStep,
  replanWaitingGoalStep,
  saveOutlineChapterStep,
  writeOutlineBandStep,
} from "./steps/course-outline-steps";

export type CourseOutlineInput = {
  courseId: string;
  bands: CourseBandNeed[];
  scope: CurriculumScope;
  analytics?: ContentAnalytics;
  waitedSkillId?: string;
  background?: boolean;
  attempt?: number;
  /** A guest's goal leaves the course's background work to a learner with an account, for the guests' daily budget. */
  forGuest?: boolean;
};

export type CourseOutlineResult =
  | { status: "busy" | "joined" }
  | { bandsWritten: number; chapterIds: string[]; status: "written" };

/** Each turn waits for a whole run, so a request still missing bands after this many is stuck, not busy. */
const MAX_OUTLINE_TURNS = 10;
const BUSY_WAIT = "15s";
const MAX_CLAIM_TRIES = 20;

type RunContext = Omit<CourseOutlineInput, "attempt" | "bands"> & { workflowRunId: string };

function toPosition({
  early,
  index,
  plan,
}: {
  early: { position: number } | null;
  index: number;
  plan: BandPlan;
}): number {
  const position = plan.nextPosition + index;
  return early && position >= early.position ? position + 1 : position;
}

/**
 * A goal that still fails to re-plan leaves the band written, not failed: its plan stays usable on
 * stand-ins until its next refresh.
 */
async function replanWaitingGoals({
  context,
  goalIds,
  skillIds,
}: {
  context: RunContext;
  goalIds: string[];
  skillIds: string[];
}): Promise<void> {
  const waiting = await listWaitingGoalsStep({
    goalIds: [...(context.analytics?.goalId ? [context.analytics.goalId] : []), ...goalIds],
    skillIds,
  });

  const conflicts: string[] = [];
  const failures: { goalId: string; reason: unknown }[] = [];

  for (const goalId of waiting) {
    // oxlint-disable-next-line no-await-in-loop -- Bound the transactions started for a popular course's waiting plans.
    const { data, error } = await safeAsync(() => replanWaitingGoalStep(goalId));

    if (error) {
      failures.push({ goalId, reason: error });
    } else if (data.conflict) {
      conflicts.push(goalId);
    }
  }

  for (const goalId of conflicts) {
    // oxlint-disable-next-line no-await-in-loop -- Healthy goals have already been planned before durable conflict retries wait.
    const { error } = await safeAsync(() => retryPlanConflicts(replanWaitingGoalStep, goalId));

    if (error) {
      failures.push({ goalId, reason: error });
    }
  }

  const [first] = failures;

  if (first) {
    await Promise.all([
      logReplanFailureStep({
        courseId: context.courseId,
        error: first.reason instanceof Error ? first.reason.message : String(first.reason),
        goalIds: failures.map(({ goalId }) => goalId),
        skillIds,
      }),
      trackGenerationFailedStep({
        analytics: context.analytics,
        contentKind: "course",
        task: "waiting-goals-replan",
      }),
    ]);
  }
}

async function writeBand({ context, plan }: { context: RunContext; plan: BandPlan }) {
  const { chapters, early, provenance } = await writeOutlineBandStep({ ...context, plan });
  const skills = [...plan.skills, ...plan.extensions.map((extension) => extension.skill)];

  const saved = await Promise.all(
    chapters.map((chapter, index) =>
      saveOutlineChapterStep({
        ...context,
        chapter,
        goalSkills: skills,
        level: plan.level,
        position: toPosition({ early, index, plan }),
        provenance,
      }),
    ),
  );

  const chapterIds = saved.map((chapter) => chapter.chapterId);

  if (plan.extensions.length > 0) {
    await placeContinuationsStep({ chapterIds, chapters, courseId: context.courseId, plan });
  }

  await replanWaitingGoals({
    context,
    goalIds: early?.goalIds ?? [],
    skillIds: skills.map((skill) => skill.id),
  });

  return early
    ? chapterIds.toSpliced(early.position - plan.nextPosition, 0, early.chapterId)
    : chapterIds;
}

async function writeBands({
  bands,
  context,
}: {
  bands: readonly BandPlan[];
  context: RunContext;
}): Promise<string[]> {
  const written = await Promise.all(bands.map((plan) => writeBand({ context, plan })));
  return written.flat();
}

async function writeClaimedBands({
  bands,
  context,
}: {
  bands: readonly BandPlan[];
  context: RunContext;
}): Promise<string[]> {
  const { analytics, courseId, workflowRunId } = context;

  try {
    const chapterIds = await writeBands({ bands, context });
    await finishCourseOutlineStep({ courseId, status: "completed", workflowRunId });

    return chapterIds;
  } catch (error) {
    await Promise.all([
      finishCourseOutlineStep({ courseId, status: "failed", workflowRunId }),
      trackGenerationFailedStep({ analytics, contentKind: "course", task: "course-outline" }),
    ]);

    throw error;
  }
}

async function startSharedCourseWork(input: CourseOutlineInput): Promise<void> {
  if (input.scope.ownerId || input.forGuest) {
    return;
  }

  await startCourseDetailsRun({ analytics: input.analytics, courseId: input.courseId });
}

async function takeNextTurn({
  attempt,
  input,
  status,
}: {
  attempt: number;
  input: CourseOutlineInput;
  status: "busy" | "joined";
}): Promise<CourseOutlineResult> {
  if (attempt >= MAX_OUTLINE_TURNS) {
    throw new Error(
      `Course ${input.courseId} still missing bands after ${MAX_OUTLINE_TURNS} turns behind other runs`,
    );
  }

  await start(courseOutlineWorkflow, [{ ...input, attempt: attempt + 1 }]);
  return { status };
}

async function planBands({
  context,
  needs,
}: {
  context: RunContext;
  needs: readonly CourseBandNeed[];
}) {
  const plans = await Promise.all(
    joinLevelBands(needs).map((band) =>
      planOutlineBandStep({ band, courseId: context.courseId, scope: context.scope }),
    ),
  );

  return plans.filter((plan) => plan !== null);
}

export async function courseOutlineWorkflow(
  input: CourseOutlineInput,
): Promise<CourseOutlineResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`course-outline:${input.courseId}`);
  const attempt = input.attempt ?? 0;

  const context: RunContext = { ...input, workflowRunId };

  if (conflict) {
    await joinRun(conflict);

    const missing = await planBands({ context, needs: input.bands });

    return missing.length > 0
      ? takeNextTurn({ attempt, input, status: "joined" })
      : { status: "joined" };
  }

  const [, outlined] = await Promise.allSettled([
    startIconEarly(context),
    writeOutline({ context, input, workflowRunId }),
  ]);

  if (outlined.status === "rejected") {
    throw outlined.reason;
  }

  return outlined.value;
}

async function startIconEarly(context: RunContext): Promise<void> {
  if (context.scope.ownerId || context.forGuest) {
    return;
  }

  await start(courseIconWorkflow, [{ analytics: context.analytics, courseId: context.courseId }]);
}

async function writeOutline({
  context,
  input,
  workflowRunId,
}: {
  context: RunContext;
  input: CourseOutlineInput;
  workflowRunId: string;
}): Promise<CourseOutlineResult> {
  const plans = await planBands({ context, needs: input.bands });

  if (plans.length === 0) {
    await startSharedCourseWork(input);
    return { bandsWritten: 0, chapterIds: [], status: "written" };
  }

  const claim = await claimCourseWhenFree({
    courseId: input.courseId,
    tries: MAX_CLAIM_TRIES,
    wait: () => sleep(BUSY_WAIT),
    workflowRunId,
  });

  if (!claim.claimed) {
    return takeNextTurn({ attempt: input.attempt ?? 0, input, status: "busy" });
  }

  const bands = claim.waited ? await planBands({ context, needs: input.bands }) : plans;
  const chapterIds = await writeClaimedBands({ bands, context });
  await startSharedCourseWork(input);

  return { bandsWritten: bands.length, chapterIds, status: "written" };
}
