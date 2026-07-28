import { type LessonKind, type StepKind, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateTag } from "next/cache";
import { hasActiveSubscription } from "../../auth/subscription";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getLessonAccessRequirement } from "../../lessons/access";
import { getSession } from "../../users/get-session";
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

/** Resolves the authenticated learner and validates the untrusted lesson ID. */
async function getCompletionRequestContext(input: CompletionInput) {
  const session = await getSession();

  if (!session) {
    return { outcome: { status: "unauthorized" as const }, status: "terminal" as const };
  }

  const userId = session.user.id;
  const lessonId = input.lessonId;

  if (!isUuid(lessonId)) {
    return { outcome: { status: "notFound" as const }, status: "terminal" as const };
  }

  return { lessonId, status: "ready" as const, userId };
}

/**
 * Loads the exact lesson state that can accept a completion mutation. The
 * trusted row establishes publication, generation, ownership, and chapter
 * position before the subscription rule is evaluated.
 */
async function getAuthorizedCompletionLesson({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}) {
  const lesson = await prisma.lesson.findFirst({
    include: {
      chapter: true,
      steps: {
        include: { chapterSentence: true, sentence: true, word: true },
        orderBy: { position: "asc" },
        where: { isPublished: true },
      },
    },
    where: getCompletableLessonWhere({ generationStatus: "completed", lessonId, userId }),
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  if (getLessonAccessRequirement({ lesson }) === "free") {
    return { lesson, status: "ready" as const };
  }

  return (await hasActiveSubscription())
    ? { lesson, status: "ready" as const }
    : { status: "subscriptionRequired" as const };
}

/**
 * Authenticates, authorizes, validates, and persists one completion for the
 * current learner. The discriminated outcome lets HTTP and native adapters
 * distinguish missing resources, subscription requirements, and invalid answer
 * sets without duplicating any permission or scoring rules.
 */
export async function completeLesson(input: CompletionInput) {
  const context = await getCompletionRequestContext(input);

  if (context.status !== "ready") {
    return context.outcome;
  }

  const { lessonId, userId } = context;
  const access = await getAuthorizedCompletionLesson({ lessonId, userId });

  if (access.status !== "ready") {
    return access;
  }

  const lesson = access.lesson;
  const submittedStepIds = new Set(Object.keys(input.answers));

  const validationData =
    lesson.kind === "review"
      ? await getReviewValidationData({
          chapterId: lesson.chapterId,
          stepIds: [...submittedStepIds],
        })
      : getRegularLessonValidationData({
          lessonKind: lesson.kind,
          steps: lesson.steps,
          submittedStepIds,
        });

  const rawStepsForValidation = validationData.steps;

  const stepsForValidation = attachSentenceTranslationsToSteps(rawStepsForValidation);

  const stepResults = validateAnswers(stepsForValidation, input.answers);

  if (
    !hasCompleteAnswerCoverage({
      expectedStepCount: validationData.expectedStepCount,
      lessonKind: lesson.kind,
      validatedStepCount: stepResults.length,
    })
  ) {
    return { status: "invalid" as const };
  }

  const score = computeLessonScore({ results: stepResults });

  const durationSeconds = getCappedLessonDurationSeconds({ startedAt: input.startedAt });

  const mergedStepResults = stepResults.map((validated) => {
    const stepId = validated.stepId;
    const timing = input.stepTimings[stepId];

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

  const completion = await submitLessonCompletion({
    durationSeconds,
    lessonId: lesson.id,
    score,
    startedAt: new Date(input.startedAt),
    stepResults: mergedStepResults,
    timeZone: input.timeZone,
    userId,
  });

  revalidateTag(getUserProgressCacheTag(userId), { expire: 0 });

  return {
    result: {
      ...completion,
      correctCount: score.correctCount,
      incorrectCount: score.incorrectCount,
    },
    status: "completed" as const,
  };
}
