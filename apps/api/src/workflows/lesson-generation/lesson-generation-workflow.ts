import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import {
  type StandaloneGeneratedLessonKind,
  isStandaloneGeneratedLessonKind,
} from "@zoonk/core/lessons/generated-companion-kinds";
import { LESSON_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { alphabetLessonWorkflow } from "./kinds/alphabet-workflow";
import { explanationLessonWorkflow } from "./kinds/explanation-workflow";
import { grammarLessonWorkflow } from "./kinds/grammar-workflow";
import { practiceLessonWorkflow } from "./kinds/practice-workflow";
import { quizLessonWorkflow } from "./kinds/quiz-workflow";
import { readingLessonWorkflow } from "./kinds/reading-workflow";
import { tutorialLessonWorkflow } from "./kinds/tutorial-workflow";
import { vocabularyLessonWorkflow } from "./kinds/vocabulary-workflow";
import { generateLessonImageStep } from "./steps/generate-lesson-image-step";
import { getLessonStep } from "./steps/get-lesson-step";
import { handleLessonFailureStep } from "./steps/handle-failure-step";
import { saveListeningLessonStep } from "./steps/save-listening-lesson-step";
import { saveTranslationLessonStep } from "./steps/save-translation-lesson-step";
import { setLessonAsCompletedStep } from "./steps/set-lesson-as-completed-step";
import { setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";

type LessonGenerationContext = Awaited<ReturnType<typeof getLessonStep>>;

type GeneratedLessonContext = LessonGenerationContext & { kind: StandaloneGeneratedLessonKind };

type GeneratedLessonCompletion = { description?: string; title?: string };

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

/** Custom, review, and generated-companion rows have no standalone AI workflow. */
function isGeneratedLessonContext(
  context: LessonGenerationContext,
): context is GeneratedLessonContext {
  return isStandaloneGeneratedLessonKind(context.kind);
}

/**
 * Routes the generated lesson row to the workflow that owns its content kind.
 * Chapter generation has already planned the lesson kind, so this step should
 * only dispatch to the matching lesson workflow instead of reclassifying it.
 */
async function generateLessonForKind(
  context: GeneratedLessonContext,
): Promise<GeneratedLessonCompletion> {
  if (context.kind === "tutorial") {
    await tutorialLessonWorkflow(context);
    return {};
  }

  if (context.kind === "explanation") {
    await explanationLessonWorkflow(context);
    return {};
  }

  if (context.kind === "practice") {
    await practiceLessonWorkflow(context);
    return {};
  }

  if (context.kind === "quiz") {
    await quizLessonWorkflow(context);
    return {};
  }

  if (context.kind === "alphabet") {
    await alphabetLessonWorkflow(context);
    return {};
  }

  if (context.kind === "vocabulary") {
    await vocabularyLessonWorkflow(context);
    return {};
  }

  if (context.kind === "reading") {
    await readingLessonWorkflow(context);
    return {};
  }

  if (context.kind === "grammar") {
    await grammarLessonWorkflow(context);
  }

  return {};
}

/**
 * Completed vocabulary and reading rows may be revisited from a pending
 * translation/listening redirect. In that repair path, reuse the completed
 * source resources to materialize the companion row without rerunning AI work.
 */
async function saveGeneratedCompanionForSource(context: LessonGenerationContext): Promise<void> {
  if (context.kind === "vocabulary") {
    await saveTranslationLessonStep(context);
    return;
  }

  if (context.kind === "reading") {
    await saveListeningLessonStep(context);
  }
}

/**
 * Owns the lesson row lifecycle for first-time content generation: skip active
 * reruns, emit completion for already-generated lessons, repair stale statuses,
 * run the kind-specific workflow, and mark the lesson completed or failed.
 */
async function runLessonGeneration(input: {
  context: LessonGenerationContext;
  lessonId: string;
  workflowRunId: string;
}): Promise<LessonGenerationResult> {
  if (shouldSkipRunningGeneration(input.context)) {
    return "ready";
  }

  if (shouldStreamExistingCompletion(input.context)) {
    await saveGeneratedCompanionForSource(input.context);
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

  const claimResult = await setLessonAsRunningStep({
    lessonId: input.lessonId,
    resetExistingSteps: input.context.generationStatus === "failed",
    workflowRunId: input.workflowRunId,
  });

  if (claimResult === "completed") {
    await streamSkipStep(LESSON_COMPLETION_STEP);
    return "ready";
  }

  if (claimResult === "skipped") {
    return "ready";
  }

  try {
    const [completion, imageUrl] = await Promise.all([
      generateLessonForKind(input.context),
      generateLessonImageStep(input.context),
    ]);

    await setLessonAsCompletedStep({
      context: input.context,
      description: completion.description,
      imageUrl,
      title: completion.title,
    });

    return "ready";
  } catch (error) {
    await handleLessonFailureStep({
      error: serializeWorkflowError(error),
      lessonId: input.lessonId,
    });

    throw error;
  }
}

/**
 * Entrypoint for lesson content generation. The workflow metadata supplies the
 * generation run id while `getLessonStep` loads the current lesson context that
 * every downstream step uses.
 */
export async function lessonGenerationWorkflow(lessonId: string): Promise<LessonGenerationResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = await getLessonStep(lessonId);

  return runLessonGeneration({ context, lessonId, workflowRunId });
}
