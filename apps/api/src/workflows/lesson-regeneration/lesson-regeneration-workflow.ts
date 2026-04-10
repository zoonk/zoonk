import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { handleLessonFailureStep } from "@/workflows/lesson-generation/steps/handle-failure-step";
import { getWorkflowMetadata } from "workflow";
import { claimLiveLessonRegenerationStep } from "./steps/claim-live-lesson-regeneration-step";
import { cleanupDraftLessonStep } from "./steps/cleanup-draft-lesson-step";
import { createDraftLessonStep } from "./steps/create-draft-lesson-step";
import { promoteRegeneratedLessonStep } from "./steps/promote-regenerated-lesson-step";

/**
 * This helper exists so draft lesson cleanup stays attached to the part of the
 * workflow that actually owns the draft. Once creation succeeds, every later
 * failure should delete that unpublished draft before the caller marks the live
 * lesson as failed.
 */
async function regenerateDraftLesson(input: {
  liveLesson: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  const draftLesson = await createDraftLessonStep({ lesson: input.liveLesson });

  try {
    const lessonGenerationResult = await lessonGenerationWorkflow(draftLesson.id, {
      preserveLessonKind: true,
    });

    if (lessonGenerationResult === "filtered") {
      throw new Error("Regenerated lesson draft was filtered out");
    }

    await activityGenerationWorkflow(draftLesson.id);

    await promoteRegeneratedLessonStep({
      draftLessonId: draftLesson.id,
      liveLesson: input.liveLesson,
      workflowRunId: input.workflowRunId,
    });
  } catch (error) {
    await cleanupDraftLessonStep({ draftLessonId: draftLesson.id });
    throw error;
  }
}

/**
 * This workflow exists so outdated AI lessons can be regenerated without
 * mutating the live lesson in place. It claims the live lesson, builds a draft
 * replacement, generates all draft content, and only then promotes the draft.
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

  try {
    await regenerateDraftLesson({ liveLesson: input.liveLesson, workflowRunId });
  } catch (error) {
    await handleLessonFailureStep({ lessonId: input.liveLesson.id });

    throw error;
  }
}
