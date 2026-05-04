import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { handleChapterFailureStep } from "@/workflows/course-generation/steps/handle-failure-step";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { CHAPTER_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { type Lesson } from "@zoonk/db";
import { getWorkflowMetadata } from "workflow";
import {
  type ExpandedChapterLesson,
  expandChapterLessons,
} from "./steps/_utils/lesson-plan-expansion";
import { addLessonsStep } from "./steps/add-lessons-step";
import { classifyLessonsStep } from "./steps/classify-lessons-step";
import { generateChapterImageStep } from "./steps/generate-chapter-image-step";
import { generateLessonsStep } from "./steps/generate-lessons-step";
import { getChapterStep } from "./steps/get-chapter-step";
import { setChapterAsCompletedStep } from "./steps/set-chapter-as-completed-step";
import { setChapterAsRunningStep } from "./steps/set-chapter-as-running-step";

async function generateExpandedLessons(
  context: Awaited<ReturnType<typeof getChapterStep>>,
): Promise<ExpandedChapterLesson[]> {
  const plan = await generateLessonsStep(context);
  const lessons = await classifyLessonsStep({ context, plan });

  return expandChapterLessons({ lessons, targetLanguage: context.course.targetLanguage });
}

/**
 * Runs the independent chapter thumbnail and lesson plan work as one parallel
 * wave. If either promise fails, the chapter workflow fails and the existing
 * failure handler marks the chapter as failed.
 */
async function generateChapterShellContent(
  context: Awaited<ReturnType<typeof getChapterStep>>,
): Promise<{ imageUrl: string | null; lessons: ExpandedChapterLesson[] }> {
  const [lessons, imageUrl] = await Promise.all([
    generateExpandedLessons(context),
    generateChapterImageStep(context),
  ]);

  return { imageUrl, lessons };
}

/**
 * Creates the chapter thumbnail and lesson rows, then marks the chapter as
 * completed. Lesson content generation starts only after this chapter shell is
 * fully ready.
 */
async function generateLessonsAndCompleteChapter({
  context,
  workflowRunId,
}: {
  context: Awaited<ReturnType<typeof getChapterStep>>;
  workflowRunId: string;
}): Promise<Lesson[]> {
  const { imageUrl, lessons } = await generateChapterShellContent(context);
  const createdLessons = await addLessonsStep({ context, lessons });

  await setChapterAsCompletedStep({ context, imageUrl, workflowRunId });

  return createdLessons;
}

/**
 * Picks the first saved lesson by its authored position instead of relying on
 * database return order from createManyAndReturn.
 */
function getFirstLesson(lessons: Lesson[]): Lesson | undefined {
  return lessons.find((lesson) => lesson.position === 0);
}

/**
 * Generates only the first lesson for the first chapter. Later chapter
 * workflows stop after lesson-shell creation so the course has a full outline
 * without spending AI work on locked future content.
 */
async function generateFirstChapterLesson({
  context,
  lessons,
}: {
  context: Awaited<ReturnType<typeof getChapterStep>>;
  lessons: Lesson[];
}): Promise<void> {
  if (context.position !== 0) {
    return;
  }

  const firstLesson = getFirstLesson(lessons);

  if (firstLesson) {
    await lessonGenerationWorkflow(firstLesson.id);
  }
}

export async function chapterGenerationWorkflow(chapterId: string): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  // Fetch chapter data (throws FatalError if not found)
  const context = await getChapterStep(chapterId);

  // Skip if actively running to avoid conflicts with another workflow instance.
  if (context.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (context.generationStatus === "completed") {
    await streamSkipStep(CHAPTER_COMPLETION_STEP);
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
  const createdLessons = await generateLessonsAndCompleteChapter({ context, workflowRunId }).catch(
    async (error: unknown) => {
      await handleChapterFailureStep({ chapterId, error: serializeWorkflowError(error) });

      throw error;
    },
  );

  // Generate lesson content outside chapter failure handling so lesson failures
  // mark that lesson without rolling back the completed chapter plan.
  await generateFirstChapterLesson({ context, lessons: createdLessons });
}
