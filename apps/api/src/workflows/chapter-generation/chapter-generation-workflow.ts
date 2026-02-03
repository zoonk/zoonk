import { handleChapterFailureStep } from "@/workflows/course-generation/steps/handle-failure-step";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { getWorkflowMetadata } from "workflow";
import { addLessonsStep } from "./steps/add-lessons-step";
import { generateLessonsStep } from "./steps/generate-lessons-step";
import { getChapterStep } from "./steps/get-chapter-step";
import { setChapterAsCompletedStep } from "./steps/set-chapter-as-completed-step";
import { setChapterAsRunningStep } from "./steps/set-chapter-as-running-step";

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

  try {
    const lessons = await generateLessonsStep(context);
    const createdLessons = await addLessonsStep({ context, lessons });

    const firstLesson = createdLessons[0];

    if (firstLesson) {
      await lessonGenerationWorkflow(firstLesson.id);
    }

    await setChapterAsCompletedStep({ context, workflowRunId });
  } catch (error) {
    await handleChapterFailureStep({ chapterId });
    throw error;
  }
}
