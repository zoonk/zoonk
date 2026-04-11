import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type LessonKind } from "@zoonk/db";
import { getWorkflowMetadata } from "workflow";
import { addActivitiesStep } from "./steps/add-activities-step";
import { determineAppliedActivityStep } from "./steps/determine-applied-activity-step";
import { determineLessonKindStep } from "./steps/determine-lesson-kind-step";
import { generateCustomActivitiesStep } from "./steps/generate-custom-activities-step";
import { getLessonStep } from "./steps/get-lesson-step";
import { handleLessonFailureStep } from "./steps/handle-failure-step";
import { removeNonLanguageLessonStep } from "./steps/remove-non-language-lesson-step";
import { setLessonAsCompletedStep } from "./steps/set-lesson-as-completed-step";
import { setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";
import { updateLessonKindStep } from "./steps/update-lesson-kind-step";

type LessonGenerationContext = Awaited<ReturnType<typeof getLessonStep>>;

type LessonGenerationResult = "filtered" | "ready";

type LessonGenerationOptions = {
  generationRunId?: string;
  regeneration?: boolean;
};

/**
 * This helper exists so the workflow decides its mode once, at the top.
 * Everything below that point can then follow either the initial-generation
 * pipeline or the regeneration pipeline without repeatedly negating the same
 * flag all over the file.
 */
function isRegeneration(input: LessonGenerationOptions) {
  return input.regeneration === true;
}

/**
 * Language courses can only contain language lessons. If the classifier says a
 * lesson in that course is actually "core" or "custom", we treat that lesson
 * as invalid for this curriculum.
 */
function isNonLanguageLesson(targetLanguage: string | null, lessonKind: LessonKind): boolean {
  return targetLanguage !== null && lessonKind !== "language";
}

/**
 * Initial generation should not run again while another workflow already owns
 * the lesson. Returning early here avoids duplicate AI work and keeps the live
 * lesson status stable.
 */
function shouldSkipRunningInitialGeneration(context: LessonGenerationContext): boolean {
  return context.generationStatus === "running";
}

/**
 * When a lesson is already completed and already has activities, the workflow
 * should behave like a no-op. We still stream the completed step so callers
 * can react consistently without regenerating content.
 */
function shouldStreamExistingCompletion(context: LessonGenerationContext): boolean {
  return context.generationStatus === "completed" && context._count.activities > 0;
}

/**
 * Some old lessons can have generated activities but a stale lesson status.
 * This path repairs that mismatch by marking the lesson completed again
 * instead of regenerating a second copy of the same activity set.
 */
function shouldRepairExistingActivities(context: LessonGenerationContext): boolean {
  return context._count.activities > 0;
}

/**
 * Only core lessons need the applied-activity classifier. Every other lesson
 * kind must explicitly skip that step so the stream reflects the real path
 * taken by the workflow.
 */
async function getAppliedActivityKindForLesson(input: {
  context: LessonGenerationContext;
  lessonKind: LessonKind;
}): Promise<Awaited<ReturnType<typeof determineAppliedActivityStep>> | null> {
  if (input.lessonKind === "core") {
    return determineAppliedActivityStep(input.context);
  }

  await streamSkipStep("determineAppliedActivity");
  return null;
}

async function getCustomActivities(
  context: LessonGenerationContext,
  lessonKind: LessonKind,
): Promise<Awaited<ReturnType<typeof generateCustomActivitiesStep>>> {
  if (lessonKind === "custom") {
    return generateCustomActivitiesStep(context);
  }

  await streamSkipStep("generateCustomActivities");
  return [];
}

/**
 * Regeneration should keep the lesson's existing classification. The lesson
 * row is the stable identity, so background refreshes only replace its
 * activities. Initial generation is the only path that reclassifies a lesson.
 */
async function getLessonKindForInitialGeneration(
  context: LessonGenerationContext,
): Promise<LessonKind> {
  return determineLessonKindStep(context);
}

/**
 * Regeneration should not reclassify the lesson. The stored lesson row is the
 * durable identity, so we keep its current kind and explicitly skip the AI
 * classifier step.
 */
async function getLessonKindForRegeneration(context: LessonGenerationContext): Promise<LessonKind> {
  await streamSkipStep("determineLessonKind");
  return context.kind;
}

/**
 * Initial generation is the only time we want the stored lesson kind to follow
 * the AI classification result. This keeps future reads aligned with the
 * generated activity set that was just created.
 */
async function syncLessonKindForInitialGeneration(input: {
  lessonId: number;
  lessonKind: LessonKind;
}): Promise<void> {
  await updateLessonKindStep({
    kind: input.lessonKind,
    lessonId: input.lessonId,
  });
}

/**
 * Regeneration must leave the lesson identity untouched. We still emit a skip
 * event for the sync step so the streamed workflow trace is explicit about why
 * the lesson row was not updated.
 */
async function skipLessonKindSyncForRegeneration(): Promise<void> {
  await streamSkipStep("updateLessonKind");
}

/**
 * Initial generation can discover that a lesson in a language course is not
 * actually a language lesson. In that case we delete the lesson instead of
 * saving an invalid activity set under it.
 */
async function handleFilteredInitialLesson(input: { lessonId: number }): Promise<"filtered"> {
  await removeNonLanguageLessonStep({ lessonId: input.lessonId });
  return "filtered";
}

/**
 * Regeneration is more conservative than initial generation. If we ever hit an
 * impossible language mismatch here, we leave cleanup to the outer regeneration
 * workflow and simply report that no replacement set should be used.
 */
function handleFilteredRegeneratedLesson(): "filtered" {
  return "filtered";
}

/**
 * Both initial generation and regeneration eventually create an activity set
 * for the same lesson. This shared helper keeps that write path in one place
 * while letting each pipeline decide whether the created activities are live
 * or hidden replacements.
 */
async function addGeneratedActivities(input: {
  appliedActivityKind: Awaited<ReturnType<typeof determineAppliedActivityStep>> | null;
  context: LessonGenerationContext;
  generationRunId: string;
  isPublished: boolean;
  lessonKind: LessonKind;
}): Promise<void> {
  const customActivities = await getCustomActivities(input.context, input.lessonKind);

  await addActivitiesStep({
    appliedActivityKind: input.appliedActivityKind,
    concepts: input.context.concepts,
    context: input.context,
    customActivities,
    generationRunId: input.generationRunId,
    isPublished: input.isPublished,
    lessonKind: input.lessonKind,
    targetLanguage: input.context.chapter.course.targetLanguage,
  });
}

/**
 * This pipeline owns first-time lesson generation. It manages the lesson row
 * lifecycle itself: skip stale reruns, mark the lesson running, generate the
 * correct activity set, then finalize the lesson as completed or failed.
 */
async function runInitialLessonGeneration(input: {
  context: LessonGenerationContext;
  lessonId: number;
  workflowRunId: string;
}): Promise<LessonGenerationResult> {
  if (shouldSkipRunningInitialGeneration(input.context)) {
    return "ready";
  }

  if (shouldStreamExistingCompletion(input.context)) {
    await streamSkipStep("setLessonAsCompleted");
    return "ready";
  }

  if (shouldRepairExistingActivities(input.context)) {
    await setLessonAsCompletedStep({
      context: input.context,
      lessonKind: input.context.kind,
    });
    return "ready";
  }

  await setLessonAsRunningStep({
    lessonId: input.lessonId,
    workflowRunId: input.workflowRunId,
  });

  try {
    const lessonKind = await getLessonKindForInitialGeneration(input.context);
    const appliedActivityKind = await getAppliedActivityKindForLesson({
      context: input.context,
      lessonKind,
    });

    await syncLessonKindForInitialGeneration({
      lessonId: input.lessonId,
      lessonKind,
    });

    if (isNonLanguageLesson(input.context.chapter.course.targetLanguage, lessonKind)) {
      return await handleFilteredInitialLesson({ lessonId: input.lessonId });
    }

    await addGeneratedActivities({
      appliedActivityKind,
      context: input.context,
      generationRunId: input.workflowRunId,
      isPublished: true,
      lessonKind,
    });

    await setLessonAsCompletedStep({
      context: input.context,
      lessonKind,
    });

    return "ready";
  } catch (error) {
    await handleLessonFailureStep({ lessonId: input.lessonId });
    throw error;
  }
}

/**
 * Regeneration only prepares a hidden replacement activity set under the live
 * lesson. It must not mutate the lesson lifecycle state here because the outer
 * regeneration workflow is responsible for promotion, cleanup, and versioning.
 */
async function runLessonRegeneration(input: {
  context: LessonGenerationContext;
  generationRunId: string;
  lessonId: number;
}): Promise<LessonGenerationResult> {
  const lessonKind = await getLessonKindForRegeneration(input.context);

  const appliedActivityKind = await getAppliedActivityKindForLesson({
    context: input.context,
    lessonKind,
  });

  await skipLessonKindSyncForRegeneration();

  if (isNonLanguageLesson(input.context.chapter.course.targetLanguage, lessonKind)) {
    return handleFilteredRegeneratedLesson();
  }

  await addGeneratedActivities({
    appliedActivityKind,
    context: input.context,
    generationRunId: input.generationRunId,
    isPublished: false,
    lessonKind,
  });

  return "ready";
}

export async function lessonGenerationWorkflow(
  lessonId: number,
  options: LessonGenerationOptions = {},
): Promise<LessonGenerationResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = await getLessonStep(lessonId);

  if (isRegeneration(options)) {
    return runLessonRegeneration({
      context,
      generationRunId: options.generationRunId ?? workflowRunId,
      lessonId,
    });
  }

  return runInitialLessonGeneration({
    context,
    lessonId,
    workflowRunId,
  });
}
