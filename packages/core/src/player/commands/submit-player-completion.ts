import "server-only";
import { type LessonKind, type StepKind, prisma } from "@zoonk/db";
import {
  getCappedLessonDurationSeconds,
  getCappedStepAttemptDurationSeconds,
} from "../contracts/completion-duration";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { computeLessonScore } from "../contracts/compute-score";
import {
  getExpectedPlayerAnswerCount,
  isLimitedLanguageSentenceLesson,
} from "../contracts/playable-lesson-steps";
import { countAnswerableSteps, validateAnswers } from "../contracts/validate-answers";
import { getReviewValidationData } from "../queries/get-review-steps";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";
import { submitLessonCompletion } from "./submit-lesson-completion";

type StepWithSentence = {
  id: string;
  kind: StepKind;
  content: unknown;
  lessonId: string;
  chapterSentence: { translation: string } | null;
  word: { id: string } | null;
  sentence: { id: string; sentence: string } | null;
};

type RegularLessonValidationData = { expectedStepCount: number; steps: StepWithSentence[] };

/**
 * Attaches chapter-scoped sentence translation data to steps.
 *
 * Listening validation compares the learner's arranged words with the
 * generated user-language translation, which lives on the exact
 * `ChapterSentence` resource referenced by the step.
 */
function attachSentenceTranslationsToSteps(steps: StepWithSentence[]) {
  return steps.map((step) => ({
    ...step,
    sentence: step.sentence
      ? { ...step.sentence, translation: step.chapterSentence?.translation ?? "" }
      : null,
  }));
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
 * Reading and listening players submit only the shuffled sentence subset they
 * showed, while older or forged clients can still submit more step ids from the
 * stored bank. Filtering to submitted lesson steps and capping at the visible
 * answer count lets valid six-step sessions complete without weakening the
 * all-answers requirement for other lesson kinds.
 */
function getSubmittedLimitedLanguageSteps({
  expectedStepCount,
  steps,
  submittedStepIds,
}: {
  expectedStepCount: number;
  steps: StepWithSentence[];
  submittedStepIds: Set<string>;
}): StepWithSentence[] {
  return steps.filter((step) => submittedStepIds.has(step.id)).slice(0, expectedStepCount);
}

/**
 * Normal lessons validate against their full stored step list, but reading and
 * listening lessons are now sentence-bank sessions. This helper keeps the
 * server's required answer count aligned with the player payload selection
 * without applying the cap to quizzes, practice, review, or static lessons.
 */
function getRegularLessonValidationData({
  lessonKind,
  steps,
  submittedStepIds,
}: {
  lessonKind: LessonKind;
  steps: StepWithSentence[];
  submittedStepIds: Set<string>;
}): RegularLessonValidationData {
  const expectedStepCount = getExpectedPlayerAnswerCount({
    answerableStepCount: countAnswerableSteps(steps),
    lessonKind,
  });

  if (!isLimitedLanguageSentenceLesson(lessonKind)) {
    return { expectedStepCount, steps };
  }

  return {
    expectedStepCount,
    steps: getSubmittedLimitedLanguageSteps({ expectedStepCount, steps, submittedStepIds }),
  };
}

/**
 * The app shell should only orchestrate request-specific concerns such as auth,
 * cache revalidation, and background execution. This command owns the shared
 * completion workflow: validate the submission and persist authoritative
 * progress without coupling lesson completion to generation side effects.
 */
export async function submitPlayerCompletion(params: {
  input: CompletionInput;
  userId: string;
}): Promise<void> {
  const lessonId = params.input.lessonId;

  const lesson = await prisma.lesson.findFirst({
    include: {
      chapter: true,
      steps: {
        include: { chapterSentence: true, sentence: true, word: true },
        orderBy: { position: "asc" },
        where: { isPublished: true },
      },
    },
    where: getCompletableLessonWhere({ lessonId, userId: params.userId }),
  });

  if (!lesson) {
    return;
  }

  const submittedStepIds = new Set(Object.keys(params.input.answers));

  const validationData =
    lesson.kind === "review"
      ? await getReviewValidationData({ lessonId: lesson.id, stepIds: [...submittedStepIds] })
      : getRegularLessonValidationData({
          lessonKind: lesson.kind,
          steps: lesson.steps,
          submittedStepIds,
        });

  const rawStepsForValidation = validationData.steps;

  const stepsForValidation = attachSentenceTranslationsToSteps(rawStepsForValidation);

  const stepResults = validateAnswers(stepsForValidation, params.input.answers);

  if (
    !hasCompleteAnswerCoverage({
      expectedStepCount: validationData.expectedStepCount,
      lessonKind: lesson.kind,
      validatedStepCount: stepResults.length,
    })
  ) {
    return;
  }

  const score = computeLessonScore({ results: stepResults });

  const durationSeconds = getCappedLessonDurationSeconds({ startedAt: params.input.startedAt });

  const mergedStepResults = stepResults.map((validated) => {
    const stepId = validated.stepId;
    const timing = params.input.stepTimings[stepId];

    return {
      answer: validated.answer,
      answeredAt: timing ? new Date(timing.answeredAt) : new Date(),
      dayOfWeek: timing?.dayOfWeek ?? new Date().getDay(),
      durationSeconds: getCappedStepAttemptDurationSeconds({
        durationSeconds: timing?.durationSeconds ?? 0,
      }),
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
}
