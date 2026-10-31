import {
  type CourseBandNeed,
  type CurriculumScope,
  joinLevelBands,
} from "@zoonk/core/library/curriculum/scope";
import { COURSE_OUTLINE_READY_STEP } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata, sleep } from "workflow";
import { type Run, start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { claimCourseWhenFree } from "./claim-course-when-free";
import { courseIconWorkflow } from "./course-details-workflow";
import { replanWaitingGoals } from "./replan-waiting-goals";
import { startCourseDetailsRun } from "./start-course-details-run";
import { type BandPlan, toChapterMoves } from "./steps/band-outline";
import {
  type CourseOutlineStreamStep,
  courseOutlineProgressStep,
  coverBandSkillsStep,
  finishCourseOutlineStep,
  needsLegacyCourseDetailsStep,
  placeChaptersAfterStep,
  planOutlineBandStep,
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
  | { nextRunId?: string; status: "busy" | "joined" }
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

  const saved = results.map((result) => (result.status === "fulfilled" ? result.value : null));
  const waited = plan.skills.filter((skill) => skill.id === context.waitedSkillId);

  const inOrder = early
    ? saved.toSpliced(early.position - plan.nextPosition, 0, {
        chapterId: early.chapterId,
        skillKeys: waited.map((skill) => skill.key),
      })
    : saved;

  const written = inOrder.filter((chapter) => chapter !== null);

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

/** A guest's run also writes the new details of a course from before learning v2. */
async function startSharedCourseWork(input: CourseOutlineInput): Promise<void> {
  if (input.scope.ownerId) {
    return;
  }

  if (input.forGuest && !(await needsLegacyCourseDetailsStep(input.courseId))) {
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

  const next = await start(courseOutlineWorkflow, [{ ...input, attempt: attempt + 1 }]);
  return { nextRunId: next.runId, status };
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

async function outlineCourse({
  conflict,
  context,
  input,
}: {
  conflict: Run<unknown> | null;
  context: RunContext;
  input: CourseOutlineInput;
}): Promise<CourseOutlineResult> {
  if (conflict) {
    await joinRun(conflict);

    const missing = await planBands({ context, needs: input.bands });

    return missing.length > 0
      ? takeNextTurn({ attempt: input.attempt ?? 0, input, status: "joined" })
      : { status: "joined" };
  }

  const [, outlined] = await Promise.allSettled([
    startIconEarly(context),
    writeOutline({ context, input, workflowRunId: context.workflowRunId }),
  ]);

  if (outlined.status === "rejected") {
    throw outlined.reason;
  }

  return outlined.value;
}

function getLastEvent(result: CourseOutlineResult): StepStreamMessage<CourseOutlineStreamStep> {
  if ("nextRunId" in result && result.nextRunId) {
    return { entityId: result.nextRunId, status: "started", step: "joinCourseOutline" };
  }

  return { status: "completed", step: COURSE_OUTLINE_READY_STEP };
}

export async function courseOutlineWorkflow(
  input: CourseOutlineInput,
): Promise<CourseOutlineResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const { conflict } = await claimRunToken(`course-outline:${input.courseId}`);

    await courseOutlineProgressStep(
      conflict
        ? { entityId: conflict.runId, status: "started", step: "joinCourseOutline" }
        : { status: "started", step: "writeCourseOutline" },
    );

    const result = await outlineCourse({ conflict, context: { ...input, workflowRunId }, input });
    await courseOutlineProgressStep(getLastEvent(result), { last: true });
    return result;
  } catch (error) {
    await courseOutlineProgressStep(
      { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP },
      { last: true },
    );

    throw error;
  }
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
