import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { handleChapterFailureStep } from "@/workflows/course-generation/steps/handle-failure-step";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getWorkflowMetadata } from "workflow";
import { addLessonsStep } from "./steps/add-lessons-step";
import { generateLessonsStep } from "./steps/generate-lessons-step";
import { getChapterStep } from "./steps/get-chapter-step";
import { setChapterAsCompletedStep } from "./steps/set-chapter-as-completed-step";
import { setChapterAsRunningStep } from "./steps/set-chapter-as-running-step";

async function generateAndAddLessons(context: Awaited<ReturnType<typeof getChapterStep>>) {
  const lessons = await generateLessonsStep(context);
  return addLessonsStep({ context, lessons });
}

export async function chapterGenerationWorkflow(chapterId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  // Fetch chapter data (throws FatalError if not found)
  const context = await getChapterStep(chapterId);

  // Skip if already running or completed
  if (context.generationStatus === "running" || context.generationStatus === "completed") {
    return;
  }

  // If chapter has lessons but status is not completed, fix the status
  if (context._count.lessons > 0) {
    await setChapterAsCompletedStep({ context, workflowRunId });
    return;
  }

  // Mark chapter as running
  await setChapterAsRunningStep({ chapterId, workflowRunId });

  // Chapter-specific work with failure handling
  const createdLessons = await generateAndAddLessons(context).catch(async (error: unknown) => {
    await handleChapterFailureStep({ chapterId });
    throw error;
  });

  // Chapter is complete once its lesson list exists
  await setChapterAsCompletedStep({ context, workflowRunId });

  // Lesson and activity generation outside chapter failure handling.
  // Each has its own error handling that marks specific resources as failed.
  const firstLesson = createdLessons[0];

  if (firstLesson) {
    await lessonGenerationWorkflow(firstLesson.id);
    await activityGenerationWorkflow(firstLesson.id);
  }
}
