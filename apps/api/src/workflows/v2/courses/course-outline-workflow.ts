import {
  type CourseBandNeed,
  type CurriculumScope,
  joinLevelBands,
} from "@zoonk/core/library/curriculum/scope";
import { safeAsync } from "@zoonk/utils/error";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { claimCourseWhenFree } from "./claim-course-when-free";
import { courseIconWorkflow } from "./course-details-workflow";
import { startCourseDetailsRun } from "./start-course-details-run";
import { type BandPlan, toChapterMoves } from "./steps/band-outline";
import {
  coverBandSkillsStep,
  finishCourseOutlineStep,
  listWaitingGoalsStep,
  logReplanFailureStep,
  placeChaptersAfterStep,
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
  const listed = await listWaitingGoalsStep({ goalIds, skillIds });
  const initiating = context.analytics?.goalId;

  const waiting =
    initiating && listed.includes(initiating)
      ? [initiating, ...listed.filter((id) => id !== initiating)]
      : listed;

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

async function writeBand({ context, plan: needed }: { context: RunContext; plan: BandPlan }) {
  const { anchors, plan, taughtSkillIds } = await deliverCourseContent(
    coverBandSkillsStep({ ...context, plan: needed }),
  );

  if (taughtSkillIds.length > 0) {
    await replanWaitingGoals({ context, goalIds: [], skillIds: taughtSkillIds });
  }

  if (plan.skills.length === 0 && plan.extensions.length === 0) {
    return [];
  }

  const { chapters, early, provenance } = await writeOutlineBandStep({ ...context, plan });
  const skills = [...plan.skills, ...plan.extensions.map((extension) => extension.skill)];

  const results = await Promise.allSettled(
    chapters.map(async (chapter, index) => {
      const { chapterId } = await deliverCourseContent(
        saveOutlineChapterStep({
          ...context,
          chapter,
          goalSkills: skills,
          level: plan.level,
          position: toPosition({ early, index, plan }),
          provenance,
        }),
      );

      return { chapterId, skillKeys: chapter.skillKeys };
    }),
  );

  const saved = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const waited = plan.skills.filter((skill) => skill.id === context.waitedSkillId);

  const written = early
    ? saved.toSpliced(early.position - plan.nextPosition, 0, {
        chapterId: early.chapterId,
        skillKeys: waited.map((skill) => skill.key),
      })
    : saved;

  const moves = toChapterMoves({ anchors, plan, written });

  // Chapters already saved, the one learners already have included, keep their place if another fails.
  if (moves.length > 0) {
    await deliverCourseContent(
      placeChaptersAfterStep({ courseId: context.courseId, level: plan.level, moves }),
    );
  }

  const failed = results.find((result) => result.status === "rejected");

  if (failed) {
    throw failed.reason;
  }

  await replanWaitingGoals({
    context,
    goalIds: early?.goalIds ?? [],
    skillIds: skills.map((skill) => skill.id),
  });

  return written.map((chapter) => chapter.chapterId);
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

    await deliverCourseContent(
      finishCourseOutlineStep({ courseId, status: "completed", workflowRunId }),
    );

    return chapterIds;
  } catch (error) {
    await Promise.all([
      deliverCourseContent(finishCourseOutlineStep({ courseId, status: "failed", workflowRunId })),
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
