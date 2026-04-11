import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getWorkflowMetadata } from "workflow";
import { claimLiveLessonRegenerationStep } from "./steps/claim-live-lesson-regeneration-step";
import { cleanupRegeneratedActivitiesStep } from "./steps/cleanup-regenerated-activities-step";
import { promoteRegeneratedLessonStep } from "./steps/promote-regenerated-lesson-step";
import { releaseLiveLessonRegenerationStep } from "./steps/release-live-lesson-regeneration-step";

/**
 * This helper exists so same-lesson regeneration owns the hidden replacement
 * activity set from creation through promotion or cleanup. Any later failure
 * should remove that unpublished replacement set before the caller reports the
 * workflow failure on the live lesson row.
 */
async function regenerateLessonActivities(input: {
  liveLesson: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  try {
    await cleanupRegeneratedActivitiesStep({ lessonId: input.liveLesson.id });

    const lessonGenerationResult = await lessonGenerationWorkflow(input.liveLesson.id, {
      generationRunId: input.workflowRunId,
      regeneration: true,
    });

    if (lessonGenerationResult !== "ready") {
      throw new Error("Regeneration unexpectedly returned a filtered lesson");
    }

    await activityGenerationWorkflow(input.liveLesson.id, { regeneration: true });

    await promoteRegeneratedLessonStep({ liveLesson: input.liveLesson });
  } catch (error) {
    await cleanupRegeneratedActivitiesStep({ lessonId: input.liveLesson.id });
    await releaseLiveLessonRegenerationStep({ lessonId: input.liveLesson.id });

    throw error;
  }
}

/**
 * This workflow exists so outdated AI lessons can be regenerated without
 * replacing the live lesson row. It claims the live lesson, builds an
 * unpublished replacement activity set under that same lesson, generates the
 * replacement content, and only then swaps the activity sets atomically.
 */
export async function lessonRegenerationWorkflow(input: {
  liveLesson: LessonContext;
}): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const claimed = await claimLiveLessonRegenerationStep({
    lesson: input.liveLesson,
    workflowRunId,
  });

  if (!claimed) {
    return;
  }

  await regenerateLessonActivities({ liveLesson: input.liveLesson, workflowRunId });
}
