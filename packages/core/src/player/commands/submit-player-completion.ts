import "server-only";
import { getLessonGenerationState } from "@zoonk/core/content/management";
import { type LessonSentence, prisma } from "@zoonk/db";
import { buildInvestigationActionResults } from "../contracts/build-investigation-action-results";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { buildScoringInput, computeActivityScore } from "../contracts/compute-score";
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
  id: bigint;
  kind: string;
  content: unknown;
  word: { id: bigint } | null;
  sentence: { id: bigint; sentence: string } | null;
};

type PlayerCompletionEffects = {
  preloadLessonId: number | null;
  regenerateLessonId: number | null;
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
  const activityId = BigInt(params.input.activityId);
  const activity = await prisma.activity.findUnique({
    include: {
      lesson: { include: { chapter: true } },
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
            stepIds: Object.keys(params.input.answers).map(BigInt),
          }),
          lessonSentences,
        )
      : attachSentenceTranslationsToSteps(activity.steps, lessonSentences);

  const stepResults = validateAnswers(stepsForValidation, params.input.answers);

  const score = computeActivityScore(
    buildScoringInput({
      activityKind: activity.kind,
      answers: params.input.answers,
      investigationLoop: params.input.investigationLoop,
      stepResults: stepResults.map((step) => ({ isCorrect: step.isCorrect })),
      steps: activity.steps.map((step) => ({
        content: step.content,
        id: String(step.id),
        kind: step.kind,
      })),
    }),
  );

  const durationSeconds = clampDuration(params.input.startedAt);

  const mergedStepResults = stepResults.map((validated) => {
    const stepId = String(validated.stepId);
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

  const investigationActionResults =
    activity.kind === "investigation"
      ? buildInvestigationActionResults({
          investigationLoop: params.input.investigationLoop,
          steps: activity.steps,
        })
      : [];

  await submitActivityCompletion({
    activityId: activity.id,
    durationSeconds,
    localDate: params.input.localDate,
    score,
    startedAt: new Date(params.input.startedAt),
    stepResults: [...mergedStepResults, ...investigationActionResults],
    userId: params.userId,
  });

  const nextLesson = await getNextLesson(activity.id);

  return {
    preloadLessonId: nextLesson?.needsGeneration ? nextLesson.id : null,
    regenerateLessonId: getLessonGenerationState({ lesson: activity.lesson })
      .shouldAutoEnqueueRegeneration
      ? activity.lesson.id
      : null,
  };
}
