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

function isNonLanguageLesson(targetLanguage: string | null, lessonKind: LessonKind): boolean {
  return targetLanguage !== null && lessonKind !== "language";
}

/**
 * This helper exists so regeneration can preserve the stored lesson kind only
 * when that kind is still valid for the course. Language courses must never
 * preserve a known-invalid "core" or "custom" kind, because doing so would
 * generate the wrong activity set instead of re-entering the safety filter.
 */
function shouldPreserveLessonKind(input: {
  context: LessonGenerationContext;
  preserveLessonKind: boolean;
}) {
  return (
    input.preserveLessonKind &&
    !isNonLanguageLesson(input.context.chapter.course.targetLanguage, input.context.kind)
  );
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

async function generateActivities(
  context: LessonGenerationContext,
  lessonId: number,
  options: {
    preserveLessonKind: boolean;
  },
): Promise<LessonKind | "filtered"> {
  const preservesLessonKind = shouldPreserveLessonKind({
    context,
    preserveLessonKind: options.preserveLessonKind,
  });

  const lessonKind = preservesLessonKind ? context.kind : await determineLessonKindStep(context);

  if (preservesLessonKind) {
    await streamSkipStep("determineLessonKind");
  }

  const appliedActivityKind =
    lessonKind === "core" ? await determineAppliedActivityStep(context) : null;

  if (lessonKind !== "core") {
    await streamSkipStep("determineAppliedActivity");
  }

  if (preservesLessonKind) {
    await streamSkipStep("updateLessonKind");
  } else {
    await updateLessonKindStep({ kind: lessonKind, lessonId });
  }

  // The AI sometimes classifies a language-course lesson as "core" or "custom"
  // (e.g., "Culture of Spain"). Delete it — these would get inappropriate activities.
  if (isNonLanguageLesson(context.chapter.course.targetLanguage, lessonKind)) {
    await removeNonLanguageLessonStep({ lessonId });
    return "filtered";
  }

  const customActivities = await getCustomActivities(context, lessonKind);

  await addActivitiesStep({
    appliedActivityKind,
    concepts: context.concepts,
    context,
    customActivities,
    lessonKind,
    targetLanguage: context.chapter.course.targetLanguage,
  });

  return lessonKind;
}

export async function lessonGenerationWorkflow(
  lessonId: number,
  options: {
    preserveLessonKind?: boolean;
  } = {},
): Promise<LessonGenerationResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = await getLessonStep(lessonId);

  // Skip if actively running to avoid conflicts with another workflow instance.
  if (context.generationStatus === "running") {
    return "ready";
  }

  // Already completed with activities — stream the completion step so the client can redirect.
  if (context.generationStatus === "completed" && context._count.activities > 0) {
    await streamSkipStep("setLessonAsCompleted");
    return "ready";
  }

  if (context._count.activities > 0) {
    await setLessonAsCompletedStep({
      context,
      lessonKind: context.kind,
      workflowRunId,
    });
    return "ready";
  }

  await setLessonAsRunningStep({ lessonId, workflowRunId });

  try {
    const result = await generateActivities(context, lessonId, {
      preserveLessonKind: options.preserveLessonKind ?? false,
    });

    if (result === "filtered") {
      return "filtered";
    }

    await setLessonAsCompletedStep({
      context,
      lessonKind: result,
      workflowRunId,
    });

    return "ready";
  } catch (error) {
    await handleLessonFailureStep({ lessonId });
    throw error;
  }
}
