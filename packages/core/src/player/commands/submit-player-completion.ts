import "server-only";
import { type LessonSentence, prisma } from "@zoonk/db";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { computeActivityScore } from "../contracts/compute-score";
import { validateAnswers } from "../contracts/validate-answers";
import { getNextLesson } from "../queries/get-next-lesson";
import { getReviewValidationSteps } from "../queries/get-review-steps";
import { submitActivityCompletion } from "./submit-activity-completion";

const MAX_DURATION_SECONDS = 7200;

function clampDuration(startedAt: number): number {
  const raw = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, Math.min(raw, MAX_DURATION_SECONDS));
}

type StepWithSentence = {
  id: string;
  kind: string;
  content: unknown;
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
 * The app shell should only orchestrate request-specific concerns such as auth,
 * cache revalidation, and background execution. This command owns the shared
 * completion workflow: validate the submission, persist authoritative progress,
 * and describe any follow-up lesson work the host app should trigger.
 */
export async function submitPlayerCompletion(params: {
  input: CompletionInput;
  userId: string;
}): Promise<PlayerCompletionEffects | null> {
  const activityId = params.input.activityId;
  const activity = await prisma.activity.findUnique({
    include: {
      steps: {
        include: { sentence: true, word: true },
        orderBy: { position: "asc" },
        where: { isPublished: true },
      },
    },
    where: { id: activityId },
  });

  if (!activity) {
    return null;
  }

  const lessonSentences = await prisma.lessonSentence.findMany({
    where: { lessonId: activity.lessonId },
  });

  const stepsForValidation =
    activity.kind === "review"
      ? attachSentenceTranslationsToSteps(
          await getReviewValidationSteps({
            lessonId: activity.lessonId,
            stepIds: Object.keys(params.input.answers),
          }),
          lessonSentences,
        )
      : attachSentenceTranslationsToSteps(activity.steps, lessonSentences);

  const stepResults = validateAnswers(stepsForValidation, params.input.answers);

  const score = computeActivityScore({ results: stepResults });

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

  await submitActivityCompletion({
    activityId: activity.id,
    durationSeconds,
    localDate: params.input.localDate,
    score,
    startedAt: new Date(params.input.startedAt),
    stepResults: mergedStepResults,
    userId: params.userId,
  });

  const nextLesson = await getNextLesson(activity.id);

  return {
    preloadLessonId: nextLesson?.needsGeneration ? nextLesson.id : null,
  };
}
