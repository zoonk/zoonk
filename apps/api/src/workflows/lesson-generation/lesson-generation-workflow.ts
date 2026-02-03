import { getWorkflowMetadata } from "workflow";
import { addActivitiesStep } from "./steps/add-activities-step";
import { determineLessonKindStep } from "./steps/determine-lesson-kind-step";
import { generateCustomActivitiesStep } from "./steps/generate-custom-activities-step";
import { getLessonStep } from "./steps/get-lesson-step";
import { handleLessonFailureStep } from "./steps/handle-failure-step";
import { setLessonAsCompletedStep } from "./steps/set-lesson-as-completed-step";
import { setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";
import { updateLessonKindStep } from "./steps/update-lesson-kind-step";

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
    const lessonKind = await determineLessonKindStep(context);
    await updateLessonKindStep({ kind: lessonKind, lessonId });

    const customActivities =
      lessonKind === "custom" ? await generateCustomActivitiesStep(context) : [];

    await addActivitiesStep({ context, customActivities, lessonKind });
    await setLessonAsCompletedStep({ context, workflowRunId });
  } catch (error) {
    await handleLessonFailureStep({ lessonId });
    throw error;
  }
}
