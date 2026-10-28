import { type CallWait } from "@zoonk/ai/provider-options";
import { MAX_LESSON_DRAFTS } from "@zoonk/core/library/generation/held-back-drafts";
import { LESSON_READY_STEP } from "@zoonk/core/library/generation/steps";
import { type PlanGenerationManifest } from "@zoonk/core/lookahead/speculative-lessons";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata, sleep } from "workflow";
import { type Run, start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { lessonCheckWorkflow } from "../quality/lesson-check-workflow";
import {
  type LessonContentResult,
  getLessonContentHookToken,
  lessonContentResultSchema,
} from "./lesson-content-result";
import { admitLessonContentStep, claimLessonContentStep } from "./steps/claim-lesson-content-step";
import { failLessonContentStep } from "./steps/fail-lesson-content-step";
import { lessonProgressStep } from "./steps/lesson-progress-step";
import { readLessonStatusStep } from "./steps/read-lesson-status-step";
import { type LessonWriteOutcome, writeLessonContentStep } from "./steps/write-lesson-content-step";
import { type LessonSpecOutcome, writeLessonSpecStep } from "./steps/write-lesson-spec-step";

export type LessonContentInput = {
  lessonId: string;
  /** Only for a plan's lesson: cost attribution alone goes in `analytics`. */
  planGoalId?: string;
  planManifest?: PlanGenerationManifest | null;
  analytics?: ContentAnalytics;
  forExam?: boolean;
  forceReview?: boolean;
  wait?: CallWait;
};

const LESSON_TASK = "lesson-content";

const WAIT_INTERVAL = "5s";
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

async function joinRunningLesson({
  lessonId,
  run,
}: {
  lessonId: string;
  run: Run<unknown>;
}): Promise<LessonContentResult> {
  await lessonProgressStep({ entityId: run.runId, status: "started", step: "joinRunningLesson" });

  const joined = lessonContentResultSchema.safeParse(await joinRun(run));
  return finish(joined.success ? joined.data : { lessonId, status: "missing" });
}

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

export async function lessonContentWorkflow(
  input: LessonContentInput,
): Promise<LessonContentResult> {
  "use workflow";

  const { lessonId } = input;

  if (
    !(await admitLessonContentStep({
      goalId: input.planGoalId,
      lessonId,
      manifest: input.planManifest,
    }))
  ) {
    return { lessonId, status: "missing" };
  }

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(getLessonContentHookToken(lessonId));

  if (conflict) {
    return joinRunningLesson({ lessonId, run: conflict });
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

  // The lesson plays without its pictures and model checks, so the waiting screens open it first.
  const ready = await finish({ lessonId, status: "ready" });

  if (outcome.imageScope) {
    const analytics = { ...input.analytics, contentScope: outcome.imageScope };
    await start(lessonImagesWorkflow, [{ analytics, lessonId }]);
  }

  if (outcome.check && (outcome.check.review || outcome.check.cite)) {
    const check = { analytics: input.analytics, forExam: input.forExam, lessonId };
    await start(lessonCheckWorkflow, [{ ...check, plan: outcome.check }]);
  }

  return ready;
}
