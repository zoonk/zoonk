import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getLessonStep } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { lessonRegenerationWorkflow } from "@/workflows/lesson-regeneration/lesson-regeneration-workflow";
import { getLessonGenerationState } from "@zoonk/core/content/management";

type LessonPreloadContext = Awaited<ReturnType<typeof getLessonStep>>;

/**
 * This helper exists so the preload workflow can route lessons by ownership
 * model instead of by transient status alone. Once an AI lesson already has a
 * stored generation version, any version mismatch belongs to the regeneration
 * path, even if that regeneration is currently paused or failed.
 */
function usesRegenerationPath(input: {
  lesson: LessonPreloadContext;
  lessonGenerationState: ReturnType<typeof getLessonGenerationState>;
}) {
  return (
    input.lesson.managementMode === "ai" &&
    input.lesson.generationVersion !== null &&
    input.lessonGenerationState.hasGenerationVersionMismatch
  );
}

export async function lessonPreloadWorkflow(lessonId: string): Promise<void> {
  "use workflow";

  const lesson = await getLessonStep(lessonId);
  const lessonGenerationState = getLessonGenerationState({ lesson });

  /**
   * Versioned outdated AI lessons never fall back to the initial generation
   * path. If regeneration is eligible, we enqueue it; otherwise we stop here
   * and let the in-flight regeneration own that lesson. This prevents the
   * legacy generation workflow from restamping the live lesson as current.
   */
  if (usesRegenerationPath({ lesson, lessonGenerationState })) {
    if (lessonGenerationState.shouldAutoEnqueueRegeneration) {
      await lessonRegenerationWorkflow({ liveLesson: lesson });
    }

    return;
  }

  const lessonGenerationResult = await lessonGenerationWorkflow(lessonId);

  if (lessonGenerationResult === "ready") {
    await activityGenerationWorkflow(lessonId);
  }
}
