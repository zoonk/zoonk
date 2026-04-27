import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { type LessonKind } from "@zoonk/db";
import { getWorkflowMetadata } from "workflow";
import { addActivitiesStep } from "./steps/add-activities-step";
import { determineLessonKindStep } from "./steps/determine-lesson-kind-step";
import { generateCoreActivitiesStep } from "./steps/generate-core-activities-step";
import { generateCustomActivitiesStep } from "./steps/generate-custom-activities-step";
import { getLessonStep } from "./steps/get-lesson-step";
import { handleLessonFailureStep } from "./steps/handle-failure-step";
import { removeNonLanguageLessonStep } from "./steps/remove-non-language-lesson-step";
import { setLessonAsCompletedStep } from "./steps/set-lesson-as-completed-step";
import { setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";
import { updateLessonKindStep } from "./steps/update-lesson-kind-step";

type LessonGenerationContext = Awaited<ReturnType<typeof getLessonStep>>;

type LessonGenerationResult = "filtered" | "ready";

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
 * can react consistently without creating duplicate content.
 */
function shouldStreamExistingCompletion(context: LessonGenerationContext): boolean {
  return context.generationStatus === "completed" && context._count.activities > 0;
}

/**
 * Some old lessons can have generated activities but a stale lesson status.
 * This path repairs that mismatch by marking the lesson completed again
 * instead of creating a second copy of the same activity set.
 */
function shouldRepairExistingActivities(context: LessonGenerationContext): boolean {
  return context._count.activities > 0;
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
 * Core lessons need a planned set of explanation titles before we create the
 * standard explanation/practice/quiz shell. Other lesson kinds explicitly skip
 * this step so the streamed trace matches the real workflow path.
 */
async function getCoreActivities(
  context: LessonGenerationContext,
  lessonKind: LessonKind,
): Promise<Awaited<ReturnType<typeof generateCoreActivitiesStep>>> {
  if (lessonKind === "core") {
    return generateCoreActivitiesStep(context);
  }

  await streamSkipStep("generateCoreActivities");
  return [];
}

/**
 * Lesson generation can discover that a lesson in a language course is not
 * actually a language lesson. In that case we delete the placeholder instead
 * of saving an invalid activity set under it.
 */
async function handleFilteredLesson(input: { lessonId: string }): Promise<"filtered"> {
  await removeNonLanguageLessonStep({ lessonId: input.lessonId });
  return "filtered";
}

/**
 * This helper keeps the activity write path in one place after the workflow
 * has decided which lesson kind it is generating.
 */
async function addGeneratedActivities(input: {
  context: LessonGenerationContext;
  generationRunId: string;
  lessonKind: LessonKind;
}): Promise<void> {
  const coreActivities = await getCoreActivities(input.context, input.lessonKind);
  const customActivities = await getCustomActivities(input.context, input.lessonKind);

  await addActivitiesStep({
    context: input.context,
    coreActivities,
    customActivities,
    generationRunId: input.generationRunId,
    isPublished: true,
    lessonKind: input.lessonKind,
    targetLanguage: input.context.chapter.course.targetLanguage,
  });
}

/**
 * This pipeline owns first-time lesson generation. It manages the lesson row
 * lifecycle itself: skip stale reruns, mark the lesson running, generate the
 * correct activity set, then finalize the lesson as completed or failed.
 */
async function runLessonGeneration(input: {
  context: LessonGenerationContext;
  lessonId: string;
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
    });
    return "ready";
  }

  await setLessonAsRunningStep({
    lessonId: input.lessonId,
    workflowRunId: input.workflowRunId,
  });

  try {
    const lessonKind = await determineLessonKindStep(input.context);

    await updateLessonKindStep({ kind: lessonKind, lessonId: input.lessonId });

    if (isNonLanguageLesson(input.context.chapter.course.targetLanguage, lessonKind)) {
      return await handleFilteredLesson({ lessonId: input.lessonId });
    }

    await addGeneratedActivities({
      context: input.context,
      generationRunId: input.workflowRunId,
      lessonKind,
    });

    await setLessonAsCompletedStep({ context: input.context });

    return "ready";
  } catch (error) {
    await handleLessonFailureStep({
      error: serializeWorkflowError(error),
      lessonId: input.lessonId,
    });

    throw error;
  }
}

export async function lessonGenerationWorkflow(lessonId: string): Promise<LessonGenerationResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = await getLessonStep(lessonId);

  return runLessonGeneration({ context, lessonId, workflowRunId });
}
