import "server-only";
import { type LessonSentence, prisma } from "@zoonk/db";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { computeLessonScore } from "../contracts/compute-score";
import { validateAnswers } from "../contracts/validate-answers";
import { getLessonSentencesForLessons } from "../queries/get-lesson-sentences";
import { getNextLesson } from "../queries/get-next-lesson";
import { getReviewValidationSteps } from "../queries/get-review-steps";
import { submitLessonCompletion } from "./submit-lesson-completion";

const MAX_DURATION_SECONDS = 7200;

function clampDuration(startedAt: number): number {
  const raw = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, Math.min(raw, MAX_DURATION_SECONDS));
}

type StepWithSentence = {
  id: string;
  kind: string;
  content: unknown;
  lessonId: string;
  word: { id: string } | null;
  sentence: { id: string; sentence: string } | null;
};

type PlayerCompletionEffects = {
  preloadLessonId: string | null;
};

/**
 * Attaches sentence translation data from `LessonSentence` records to steps.
 * Translations live on the `LessonSentence` junction table instead of a separate
 * `SentenceTranslation` model, so we flatten the canonical translation onto each step
 * before passing the result to `validateAnswers`.
 */
function attachSentenceTranslationsToSteps(
  steps: StepWithSentence[],
  lessonSentences: LessonSentence[],
) {
  const translationMap = new Map(lessonSentences.map((ls) => [ls.sentenceId, ls]));

  return steps.map((step) => ({
    ...step,
    sentence: step.sentence
      ? {
          ...step.sentence,
          translation: translationMap.get(step.sentence.id)?.translation ?? "",
        }
      : null,
  }));
}

/**
 * Review validation receives steps from earlier lessons in the chapter, so
 * sentence translations must be looked up from those source lessons. Normal
 * lesson validation keeps using the current lesson id.
 */
function getValidationSentenceLessonIds({
  lessonId,
  steps,
}: {
  lessonId: string;
  steps: StepWithSentence[];
}) {
  return steps.length === 0 ? [lessonId] : [...new Set(steps.map((step) => step.lessonId))];
}

/**
 * The app shell should only orchestrate request-specific concerns such as auth,
 * cache revalidation, and background execution. This command owns the shared
 * completion workflow: validate the submission, persist authoritative progress,
 * and describe any follow-up lesson work the host app should trigger.
 */
export async function submitPlayerCompletion(params: {
  input: CompletionInput;
  userId: string;
}): Promise<PlayerCompletionEffects | null> {
  const lessonId = params.input.lessonId;
  const lesson = await prisma.lesson.findUnique({
    include: {
      steps: {
        include: { sentence: true, word: true },
        orderBy: { position: "asc" },
        where: { isPublished: true },
      },
    },
    where: { id: lessonId },
  });

  if (!lesson) {
    return null;
  }

  const rawStepsForValidation =
    lesson.kind === "review"
      ? await getReviewValidationSteps({
          lessonId: lesson.id,
          stepIds: Object.keys(params.input.answers),
        })
      : lesson.steps;

  const lessonSentences = await getLessonSentencesForLessons({
    lessonIds:
      lesson.kind === "review"
        ? getValidationSentenceLessonIds({
            lessonId: lesson.id,
            steps: rawStepsForValidation,
          })
        : [lesson.id],
  });

  const stepsForValidation = attachSentenceTranslationsToSteps(
    rawStepsForValidation,
    lessonSentences,
  );

  const stepResults = validateAnswers(stepsForValidation, params.input.answers);

  const score = computeLessonScore({ results: stepResults });

  const durationSeconds = clampDuration(params.input.startedAt);

  const mergedStepResults = stepResults.map((validated) => {
    const stepId = validated.stepId;
    const timing = params.input.stepTimings[stepId];

    return {
      answer: validated.answer,
      answeredAt: timing ? new Date(timing.answeredAt) : new Date(),
      dayOfWeek: timing?.dayOfWeek ?? new Date().getDay(),
      durationSeconds: timing?.durationSeconds ?? 0,
      hourOfDay: timing?.hourOfDay ?? new Date().getHours(),
      isCorrect: validated.isCorrect,
      stepId: validated.stepId,
    };
  });

  await submitLessonCompletion({
    durationSeconds,
    lessonId: lesson.id,
    localDate: params.input.localDate,
    score,
    startedAt: new Date(params.input.startedAt),
    stepResults: mergedStepResults,
    userId: params.userId,
  });

  const nextLesson = await getNextLesson(lesson.id);

  return {
    preloadLessonId: nextLesson?.needsGeneration ? nextLesson.id : null,
  };
}
