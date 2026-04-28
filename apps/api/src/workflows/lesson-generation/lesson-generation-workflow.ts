import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { LESSON_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { explanationLessonWorkflow } from "./kinds/explanation-workflow";
import { grammarLessonWorkflow } from "./kinds/grammar-workflow";
import { listeningLessonWorkflow } from "./kinds/listening-workflow";
import { practiceLessonWorkflow } from "./kinds/practice-workflow";
import { quizLessonWorkflow } from "./kinds/quiz-workflow";
import { readingLessonWorkflow } from "./kinds/reading-workflow";
import { translationLessonWorkflow } from "./kinds/translation-workflow";
import { tutorialLessonWorkflow } from "./kinds/tutorial-workflow";
import { vocabularyLessonWorkflow } from "./kinds/vocabulary-workflow";
import { getLessonStep } from "./steps/get-lesson-step";
import { handleLessonFailureStep } from "./steps/handle-failure-step";
import { setLessonAsCompletedStep } from "./steps/set-lesson-as-completed-step";
import { setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";

type LessonGenerationContext = Awaited<ReturnType<typeof getLessonStep>>;
type GeneratedLessonContext = LessonGenerationContext & {
  kind: Exclude<LessonGenerationContext["kind"], "custom" | "review">;
};

type LessonGenerationResult = "filtered" | "ready";

/**
 * Running lessons already have another workflow owner, so this run should avoid
 * duplicate AI work and leave the current status untouched.
 */
function shouldSkipRunningGeneration(context: LessonGenerationContext): boolean {
  return context.generationStatus === "running";
}

/**
 * A completed generated lesson should behave as a no-op while still emitting
 * the completion event expected by the generation page.
 */
function shouldStreamExistingCompletion(context: LessonGenerationContext): boolean {
  return context.generationStatus === "completed";
}

/**
 * A lesson with saved steps but a stale status should be repaired instead of
 * generating a duplicate step set. Failed lessons are excluded because a failed
 * save may leave partial steps behind; those need a clean retry.
 */
function shouldRepairExistingSteps(context: LessonGenerationContext): boolean {
  return context.generationStatus !== "failed" && context._count.steps > 0;
}

/** Custom and review lesson rows are not AI-generated lesson content. */
function isGeneratedLessonContext(
  context: LessonGenerationContext,
): context is GeneratedLessonContext {
  return context.kind !== "custom" && context.kind !== "review";
}

async function generateLessonForKind(context: GeneratedLessonContext): Promise<void> {
  if (context.kind === "tutorial") {
    await tutorialLessonWorkflow(context);
    return;
  }

  if (context.kind === "explanation") {
    await explanationLessonWorkflow(context);
    return;
  }

  if (context.kind === "practice") {
    await practiceLessonWorkflow(context);
    return;
  }

  if (context.kind === "quiz") {
    await quizLessonWorkflow(context);
    return;
  }

  if (context.kind === "alphabet" || context.kind === "vocabulary") {
    await vocabularyLessonWorkflow(context);
    return;
  }

  if (context.kind === "translation") {
    await translationLessonWorkflow(context);
    return;
  }

  if (context.kind === "reading") {
    await readingLessonWorkflow(context);
    return;
  }

  if (context.kind === "listening") {
    await listeningLessonWorkflow(context);
    return;
  }

  if (context.kind === "grammar") {
    await grammarLessonWorkflow(context);
  }
}

async function runLessonGeneration(input: {
  context: LessonGenerationContext;
  lessonId: string;
  workflowRunId: string;
}): Promise<LessonGenerationResult> {
  if (shouldSkipRunningGeneration(input.context)) {
    return "ready";
  }

  if (shouldStreamExistingCompletion(input.context)) {
    await streamSkipStep(LESSON_COMPLETION_STEP);
    return "ready";
  }

  if (shouldRepairExistingSteps(input.context)) {
    await setLessonAsCompletedStep({ context: input.context });
    return "ready";
  }

  if (!isGeneratedLessonContext(input.context)) {
    return "filtered";
  }

  await setLessonAsRunningStep({
    lessonId: input.lessonId,
    resetExistingSteps: input.context.generationStatus === "failed",
    workflowRunId: input.workflowRunId,
  });

  try {
    await generateLessonForKind(input.context);
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
