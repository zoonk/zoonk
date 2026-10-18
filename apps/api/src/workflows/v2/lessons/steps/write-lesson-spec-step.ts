import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { keepTeachingPictures } from "@zoonk/ai/tasks/v2/lesson-spec/picture-need";
import { claimLibraryGeneration } from "@zoonk/core/library/claims/generation";
import { loadLessonSpecInputs } from "@zoonk/core/library/curriculum/lesson-spec-inputs";
import { saveLessonSpecs } from "@zoonk/core/library/curriculum/save-lesson-specs";
import { getLessonSpecModel } from "@zoonk/core/library/curriculum/scope";
import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";
import { loadLessonReuse } from "@zoonk/core/library/lessons/reuse";
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
  /** When a learner reaches the lesson (see `LessonContentInput`). */
  wait?: CallWait;
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
  wait = "soon",
  workflowRunId,
}: SpecInput): Promise<LessonSpecOutcome> {
  const inputs = await loadLessonSpecInputs(lessonId);

  if (!inputs) {
    return "missing";
  }

  const context = toContentAnalytics({ analytics, scope: inputs.scope, workflowRunId });

  // Exams its learners prepare for, its language or other learners' goals make a shared lesson
  // very likely reused.
  const reuse = await loadLessonReuse({
    forExam: (inputs.prompt.exams?.length ?? 0) > 0,
    lessonId,
  });

  const { data, provenance } = await withAiRetry(() =>
    generateLessonSpec({
      ...inputs.prompt,
      analytics: context,
      model: getLessonSpecModel(inputs.scope),
      serviceTier: chooseServiceTier({ reuse, wait }),
    }),
  );

  // Pictures that would only decorate go before the writer asks for them, so none is drawn.
  const specs = await Promise.all(
    data.lessons.map((spec) => keepTeachingPictures({ analytics: context, spec })),
  );

  const saved = await saveLessonSpecs({
    analytics: context,
    homeChapterId: inputs.homeChapterId,
    lessonId,
    provenance,
    scope: inputs.scope,
    specs,
    workflowRunId,
  });

  return saved.status === "saved" ? "ready" : "missing";
}

/**
 * Makes sure a lesson has its spec: 1 to 3 skills, the screen plan and where an activity or a
 * picture teaches (a planned picture that would only decorate is dropped before it's drawn).
 * Specs are usually written a chapter ahead, so most lessons skip this; one that another run is
 * planning right now is waited for instead of planned twice.
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
