import { getWorkflowMetadata } from "workflow";
import { addActivitiesStep } from "./steps/add-activities-step";
import { determineLessonKindStep } from "./steps/determine-lesson-kind-step";
import { generateCustomActivitiesStep } from "./steps/generate-custom-activities-step";
import { getLessonStep } from "./steps/get-lesson-step";
import { handleLessonFailureStep } from "./steps/handle-failure-step";
import { removeNonLanguageLessonStep } from "./steps/remove-non-language-lesson-step";
import { setLessonAsCompletedStep } from "./steps/set-lesson-as-completed-step";
import { setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";
import { updateLessonKindStep } from "./steps/update-lesson-kind-step";
import { streamStatus } from "./stream-status";

function isNonLanguageLesson(targetLanguage: string | null, lessonKind: string): boolean {
  return targetLanguage !== null && lessonKind !== "language";
}

async function getCustomActivities(
  context: Awaited<ReturnType<typeof getLessonStep>>,
  lessonKind: string,
): Promise<Awaited<ReturnType<typeof generateCustomActivitiesStep>>> {
  if (lessonKind === "custom") {
    return generateCustomActivitiesStep(context);
  }

  await streamStatus({ status: "completed", step: "generateCustomActivities" });
  return [];
}

async function generateActivities(
  context: Awaited<ReturnType<typeof getLessonStep>>,
  lessonId: number,
): Promise<"filtered" | "completed"> {
  const lessonKind = await determineLessonKindStep(context);
  await updateLessonKindStep({ kind: lessonKind, lessonId });

  // The AI sometimes classifies a language-course lesson as "core" or "custom"
  // (e.g., "Culture of Spain"). Delete it — these would get inappropriate activities.
  if (isNonLanguageLesson(context.chapter.course.targetLanguage, lessonKind)) {
    await removeNonLanguageLessonStep({ lessonId });
    return "filtered";
  }

  const customActivities = await getCustomActivities(context, lessonKind);
  await addActivitiesStep({
    context,
    customActivities,
    lessonKind,
    targetLanguage: context.chapter.course.targetLanguage,
  });

  return "completed";
}

export async function lessonGenerationWorkflow(lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = await getLessonStep(lessonId);

  if (context.generationStatus === "running") {
    return;
  }

  if (context.generationStatus === "completed" && context._count.activities > 0) {
    return;
  }

  if (context._count.activities > 0) {
    await setLessonAsCompletedStep({ context, workflowRunId });
    return;
  }

  await setLessonAsRunningStep({ lessonId, workflowRunId });

  try {
    const result = await generateActivities(context, lessonId);

    if (result === "completed") {
      await setLessonAsCompletedStep({ context, workflowRunId });
    }
  } catch (error) {
    await handleLessonFailureStep({ lessonId });
    throw error;
  }
}
