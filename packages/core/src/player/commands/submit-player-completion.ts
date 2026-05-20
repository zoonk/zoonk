import "server-only";
import { type LessonSentence, type StepKind, getPublishedLessonWhere, prisma } from "@zoonk/db";
import {
  type NextLessonInCourse,
  getNextLessonInCourse,
} from "../../lessons/get-next-lesson-in-course";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { computeLessonScore } from "../contracts/compute-score";
import { countAnswerableSteps, validateAnswers } from "../contracts/validate-answers";
import { getLessonSentencesForLessons } from "../queries/get-lesson-sentences";
import { getReviewValidationData } from "../queries/get-review-steps";
import { submitLessonCompletion } from "./submit-lesson-completion";

const MAX_DURATION_SECONDS = 7200;

function clampDuration(startedAt: number): number {
  const raw = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, Math.min(raw, MAX_DURATION_SECONDS));
}

type StepWithSentence = {
  id: string;
  kind: StepKind;
  content: unknown;
  lessonId: string;
  word: { id: string } | null;
  sentence: { id: string; sentence: string } | null;
};

type PlayerCompletionEffects = { preloadLessonId: string | null };

/**
 * Completion is only valid for lessons the learner can reach through the
 * product. Public brand courses are always eligible, and organization-less
 * courses are eligible only for the user who owns that generated course.
 */
function getCompletableLessonWhere({ lessonId, userId }: { lessonId: string; userId: string }) {
  return getPublishedLessonWhere({
    courseWhere: { OR: [{ organization: { kind: "brand" } }, { organizationId: null, userId }] },
    lessonWhere: { id: lessonId },
  });
}

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
      ? { ...step.sentence, translation: translationMap.get(step.sentence.id)?.translation ?? "" }
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
 * Interactive completion is only trustworthy when every server-required answer
 * produced a validation result. Static lessons have zero required answers, but
 * review lessons are never static: the page shows an empty state instead of the
 * player when there are no on-demand review steps.
 */
function hasCompleteAnswerCoverage(params: {
  expectedStepCount: number;
  lessonKind: string;
  validatedStepCount: number;
}) {
  if (params.lessonKind === "review" && params.expectedStepCount === 0) {
    return false;
  }

  return params.validatedStepCount === params.expectedStepCount;
}

/**
 * Completion only asks the host app to preload lesson generation when the next
 * structural lesson exists and is in a retryable unfinished state. Running
 * generation already has work in flight, and completed lessons need no preload.
 */
function getPreloadLessonId({ nextLesson }: { nextLesson: NextLessonInCourse | null }) {
  if (!nextLesson) {
    return null;
  }

  if (
    nextLesson.lessonGenerationStatus === "pending" ||
    nextLesson.lessonGenerationStatus === "failed"
  ) {
    return nextLesson.lessonId;
  }

  return null;
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

  const lesson = await prisma.lesson.findFirst({
    include: {
      chapter: true,
      steps: {
        include: { sentence: true, word: true },
        orderBy: { position: "asc" },
        where: { isPublished: true },
      },
    },
    where: getCompletableLessonWhere({ lessonId, userId: params.userId }),
  });

  if (!lesson) {
    return null;
  }

  const validationData =
    lesson.kind === "review"
      ? await getReviewValidationData({
          lessonId: lesson.id,
          stepIds: Object.keys(params.input.answers),
        })
      : { expectedStepCount: countAnswerableSteps(lesson.steps), steps: lesson.steps };

  const rawStepsForValidation = validationData.steps;

  const lessonSentences = await getLessonSentencesForLessons({
    lessonIds:
      lesson.kind === "review"
        ? getValidationSentenceLessonIds({ lessonId: lesson.id, steps: rawStepsForValidation })
        : [lesson.id],
  });

  const stepsForValidation = attachSentenceTranslationsToSteps(
    rawStepsForValidation,
    lessonSentences,
  );

  const stepResults = validateAnswers(stepsForValidation, params.input.answers);

  if (
    !hasCompleteAnswerCoverage({
      expectedStepCount: validationData.expectedStepCount,
      lessonKind: lesson.kind,
      validatedStepCount: stepResults.length,
    })
  ) {
    return null;
  }

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

  const nextLesson = await getNextLessonInCourse({
    chapterId: lesson.chapterId,
    chapterPosition: lesson.chapter.position,
    courseId: lesson.chapter.courseId,
    lessonPosition: lesson.position,
  });

  return { preloadLessonId: getPreloadLessonId({ nextLesson }) };
}
