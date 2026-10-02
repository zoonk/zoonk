import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { claimLibraryGeneration } from "@zoonk/core/library/claims/generation";
import { loadLessonSpecInputs } from "@zoonk/core/library/curriculum/lesson-spec-inputs";
import { saveLessonSpecs } from "@zoonk/core/library/curriculum/save-lesson-specs";
import { getScopeModel } from "@zoonk/core/library/curriculum/scope";
import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";
import { prisma } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { isRunActive } from "../../_shared/run-activity";
import { type LessonStreamStep } from "./lesson-progress-step";

/** `waiting`: another live run is planning this lesson; check again shortly. */
export type LessonSpecOutcome = "missing" | "ready" | "waiting";

type SpecInput = {
  analytics?: ContentAnalytics;
  lessonId: string;
  priority?: boolean;
  workflowRunId: string;
};

/** A spec claim held by a run that stopped is released, so this run can plan the lesson. */
async function claimSpec({ lessonId, workflowRunId }: SpecInput) {
  const claim = await claimLibraryGeneration({ id: lessonId, target: "lessonSpec", workflowRunId });

  if (claim !== "running") {
    return claim;
  }

  const lesson = await prisma.lesson.findUnique({
    select: { specRunId: true },
    where: { id: lessonId },
  });

  const ownerId = lesson?.specRunId;

  if (!ownerId || (await isRunActive(ownerId))) {
    return claim;
  }

  await releaseStaleLessonClaims({ lessonId, staleRunId: ownerId });

  return claimLibraryGeneration({ id: lessonId, target: "lessonSpec", workflowRunId });
}

async function planLesson({
  analytics,
  lessonId,
  priority,
  workflowRunId,
}: SpecInput): Promise<LessonSpecOutcome> {
  const inputs = await loadLessonSpecInputs(lessonId);

  if (!inputs) {
    return "missing";
  }

  const context = toContentAnalytics({ analytics, scope: inputs.scope, workflowRunId });

  const { data, provenance } = await withAiRetry(() =>
    generateLessonSpec({
      ...inputs.prompt,
      analytics: context,
      model: getScopeModel(inputs.scope),
      serviceTier: priority ? "priority" : undefined,
    }),
  );

  const saved = await saveLessonSpecs({
    analytics: context,
    homeChapterId: inputs.homeChapterId,
    lessonId,
    provenance,
    scope: inputs.scope,
    specs: data.lessons,
    workflowRunId,
  });

  return saved.status === "saved" ? "ready" : "missing";
}

/**
 * Makes sure a lesson has its spec: 1 to 3 skills, the screen plan and where an activity or a
 * picture teaches. Specs are usually written a chapter ahead, so most lessons skip this; one that
 * another run is planning right now is waited for instead of planned twice.
 */
export async function writeLessonSpecStep(input: SpecInput): Promise<LessonSpecOutcome> {
  "use step";

  const claim = await claimSpec(input);

  if (claim === "completed") {
    return "ready";
  }

  if (claim === "running") {
    return "waiting";
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: input.lessonId, status: "started", step: "planLesson" });

  const outcome = await planLesson(input);

  await stream.status({ entityId: input.lessonId, status: "completed", step: "planLesson" });

  return outcome;
}
