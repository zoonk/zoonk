import { MAX_LESSON_DRAFTS } from "@zoonk/core/library/generation/held-back-drafts";
import { LESSON_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { PRIVATE_MAX_IMAGES, lessonImagesWorkflow } from "../images/lesson-images-workflow";
import {
  type LessonContentResult,
  getLessonContentHookToken,
  lessonContentResultSchema,
} from "./lesson-content-result";
import { claimLessonContentStep } from "./steps/claim-lesson-content-step";
import { failLessonContentStep } from "./steps/fail-lesson-content-step";
import { lessonProgressStep } from "./steps/lesson-progress-step";
import { readLessonStatusStep } from "./steps/read-lesson-status-step";
import { type LessonWriteOutcome, writeLessonContentStep } from "./steps/write-lesson-content-step";
import { type LessonSpecOutcome, writeLessonSpecStep } from "./steps/write-lesson-spec-step";

export type LessonContentInput = {
  lessonId: string;
  /** The learner and goal the lesson is being made for, so its cost adds up per learner. */
  analytics?: ContentAnalytics;
  /** Made for an exam goal, so the reasoning check always runs. */
  forExam?: boolean;
  /** A rewrite after a later check failed: the reasoning check always runs. */
  forceReview?: boolean;
  /**
   * A learner is waiting on it: a new goal's first lesson, or one opened before it was written.
   * Its spec and writing run at the priority tier, about twice as fast at twice the price.
   */
  priority?: boolean;
};

/** How analytics names this run's work when it fails. */
const LESSON_TASK = "lesson-content";

/** Specs take about 20 seconds; another run planning this lesson is checked on this often. */
const WAIT_INTERVAL = "5s";
/** Three minutes of checks: past that, the other run is treated as stuck and this one gives up. */
const MAX_WAITS = 36;

async function finish({ lessonId, status }: LessonContentResult): Promise<LessonContentResult> {
  await lessonProgressStep(
    status === "ready"
      ? { entityId: lessonId, status: "completed", step: LESSON_READY_STEP }
      : {
          entityId: lessonId,
          reason: "contentValidationFailed",
          status: "error",
          step: WORKFLOW_ERROR_STEP,
        },
  );

  return { lessonId, status };
}

/**
 * Another request is already writing this lesson: this run follows it and ends with its result,
 * so whichever run a client streams from, it sees the lesson get ready.
 */
async function joinRunningLesson({
  lessonId,
  returnValue,
  runId,
}: {
  lessonId: string;
  returnValue: Promise<unknown>;
  runId: string;
}): Promise<LessonContentResult> {
  await lessonProgressStep({ entityId: runId, status: "started", step: "joinRunningLesson" });

  try {
    return await finish(lessonContentResultSchema.parse(await returnValue));
  } catch {
    return finish({ lessonId, status: "missing" });
  }
}

/** A run outside this lesson's hook holds the claim, such as an explanation saving it: wait for it. */
async function waitForOwner(lessonId: string) {
  const status = await repeatUntil({
    done: (current) => current !== "generating",
    run: async () => {
      await sleep(WAIT_INTERVAL);
      return readLessonStatusStep(lessonId);
    },
    times: MAX_WAITS,
  });

  return finish({ lessonId, status: status === "ready" ? "ready" : "busy" });
}

function planWhenFree({
  input,
  workflowRunId,
}: {
  input: LessonContentInput;
  workflowRunId: string;
}): Promise<LessonSpecOutcome> {
  return repeatUntil({
    done: (outcome) => outcome !== "waiting",
    run: () => writeLessonSpecStep({ ...input, workflowRunId }),
    times: MAX_WAITS,
    wait: () => sleep(WAIT_INTERVAL),
  });
}

/** Takes the lesson's claim back after its checks held a draft back, then drafts it again. */
async function redraft({
  input,
  workflowRunId,
}: {
  input: LessonContentInput;
  workflowRunId: string;
}): Promise<LessonWriteOutcome> {
  const claim = await claimLessonContentStep({ lessonId: input.lessonId, workflowRunId });

  if (claim.status !== "claimed") {
    return { redraft: false, status: "heldBack" };
  }

  return writeLessonContentStep({ ...input, workflowRunId });
}

/**
 * Writes the lesson, and drafts it again at once while its checks hold drafts back and it has
 * drafts left (core picks each draft's writer and tells it what held the earlier ones back), so a
 * learner waiting on the lesson gets it from this same run. After the last one, core sets the
 * lesson aside and plans move on without it.
 */
function writeUntilPublished({
  input,
  workflowRunId,
}: {
  input: LessonContentInput;
  workflowRunId: string;
}): Promise<LessonWriteOutcome> {
  return repeatUntil<LessonWriteOutcome>({
    done: (outcome) => outcome.status !== "heldBack" || !outcome.redraft,
    run: (previous) =>
      previous
        ? redraft({ input, workflowRunId })
        : writeLessonContentStep({ ...input, workflowRunId }),
    times: MAX_LESSON_DRAFTS,
  });
}

/** Plans the lesson if it has no spec yet, then writes it. Failures end this run's claims. */
async function planAndWrite({
  input,
  workflowRunId,
}: {
  input: LessonContentInput;
  workflowRunId: string;
}): Promise<LessonWriteOutcome> {
  const claim = { lessonId: input.lessonId, workflowRunId };

  const failed = { analytics: input.analytics, contentKind: "lesson", task: LESSON_TASK } as const;

  try {
    const spec = await planWhenFree({ input, workflowRunId });

    if (spec !== "ready") {
      await failLessonContentStep(claim);
      return { status: "notWritten" };
    }

    const outcome = await writeUntilPublished({ input, workflowRunId });

    if (outcome.status === "heldBack") {
      await trackGenerationFailedStep(failed);
    }

    return outcome;
  } catch (error) {
    // The waiting screens hear it failed at once, so the learner can try again.
    await Promise.all([
      failLessonContentStep(claim),
      trackGenerationFailedStep(failed),
      lessonProgressStep({
        entityId: input.lessonId,
        reason: "aiGenerationFailed",
        status: "error",
        step: WORKFLOW_ERROR_STEP,
      }),
    ]);

    throw error;
  }
}

/**
 * Makes one lesson playable on demand: it claims the lesson's content (one run per lesson; a
 * second request joins the first and streams the same result), writes the spec when the chapter
 * ahead didn't already, writes and checks the screens, and publishes them. Pictures follow in the
 * background, since the lesson reads fine without them. A draft its checks hold back is drafted
 * again in this run while the lesson has drafts left; a lesson set aside isn't written again.
 * Progress goes to the run's stream, so the waiting screen shows live steps; rate limits retry
 * after a minute, and a run that fails frees the lesson for the next one.
 */
export async function lessonContentWorkflow(
  input: LessonContentInput,
): Promise<LessonContentResult> {
  "use workflow";

  const { lessonId } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: getLessonContentHookToken(lessonId) });
  const conflict = await hook.getConflict();

  if (conflict) {
    return joinRunningLesson({
      lessonId,
      returnValue: conflict.returnValue,
      runId: conflict.runId,
    });
  }

  const claim = await claimLessonContentStep({ lessonId, workflowRunId });

  if (claim.status === "missing" || claim.status === "completed") {
    return finish({ lessonId, status: claim.status === "completed" ? "ready" : "missing" });
  }

  if (claim.status === "setAside") {
    return finish({ lessonId, status: "heldBack" });
  }

  if (claim.status === "running") {
    return waitForOwner(lessonId);
  }

  const outcome = await planAndWrite({ input, workflowRunId });

  if (outcome.status !== "published") {
    return finish({ lessonId, status: outcome.status === "heldBack" ? "heldBack" : "missing" });
  }

  // The lesson plays without its pictures, so the waiting screens open it before they're started.
  const ready = await finish({ lessonId, status: "ready" });

  if (outcome.imageScope) {
    const maxImages = outcome.imageScope === "personal" ? PRIVATE_MAX_IMAGES : undefined;
    const analytics = { ...input.analytics, contentScope: outcome.imageScope };
    await start(lessonImagesWorkflow, [{ analytics, lessonId, maxImages }]);
  }

  return ready;
}
