"use server";

import { getReviewValidationSteps } from "@/data/activities/get-review-steps";
import { preloadNextLesson } from "@/data/progress/preload-next-lesson";
import { submitActivityCompletion } from "@/data/progress/submit-activity-completion";
import { auth } from "@zoonk/core/auth";
import { type LessonSentence, prisma } from "@zoonk/db";
import { type CompletionInput, completionInputSchema } from "@zoonk/player/completion-input-schema";
import { computeScore } from "@zoonk/player/compute-score";
import { validateAnswers } from "@zoonk/player/validate-answers";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

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
 * Validates and persists an activity completion in the background.
 *
 * The client computes metrics (BP, energy, belt) locally for instant display.
 * This server action handles the authoritative validation and DB persistence
 * via `after()`, so the response returns immediately after the auth check.
 */
export async function submitCompletion(rawInput: CompletionInput): Promise<void> {
  const parsed = completionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return;
  }

  const input = parsed.data;

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    return;
  }

  const userId = Number(session.user.id);
  const activityId = BigInt(input.activityId);

  after(async () => {
    try {
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
        logError(`[submitCompletion] Activity ${activityId} not found`);
        return;
      }

      const lessonSentences = await prisma.lessonSentence.findMany({
        where: { lessonId: activity.lessonId },
      });

      const stepsForValidation =
        activity.kind === "review"
          ? attachSentenceTranslationsToSteps(
              await getReviewValidationSteps(
                activity.lessonId,
                Object.keys(input.answers).map(BigInt),
              ),
              lessonSentences,
            )
          : attachSentenceTranslationsToSteps(activity.steps, lessonSentences);

      const stepResults = validateAnswers(stepsForValidation, input.answers);

      const score = computeScore({
        results: stepResults.map((step) => ({ isCorrect: step.isCorrect })),
      });

      const durationSeconds = clampDuration(input.startedAt);

      const mergedStepResults = stepResults.map((validated) => {
        const stepId = String(validated.stepId);
        const timing = input.stepTimings[stepId];

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
        courseId: activity.lesson.chapter.courseId,
        durationSeconds,
        localDate: input.localDate,
        organizationId: activity.organizationId,
        score,
        startedAt: new Date(input.startedAt),
        stepResults: mergedStepResults,
        userId,
      });

      revalidatePath("/");
      await preloadNextLesson(activityId, reqHeaders.get("cookie") ?? "");
    } catch (error) {
      logError("[submitCompletion] Failed to persist activity completion:", error);
    }
  });
}
