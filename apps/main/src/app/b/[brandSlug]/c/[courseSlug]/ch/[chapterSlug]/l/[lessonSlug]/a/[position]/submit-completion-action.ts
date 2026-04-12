"use server";

import { getReviewValidationSteps } from "@/data/activities/get-review-steps";
import { preloadNextLesson } from "@/data/progress/preload-next-lesson";
import { queueLessonRegeneration } from "@/data/progress/queue-lesson-regeneration";
import { submitActivityCompletion } from "@/data/progress/submit-activity-completion";
import { auth } from "@zoonk/core/auth";
import { type LessonSentence, prisma } from "@zoonk/db";
import { buildInvestigationActionResults } from "@zoonk/player/build-investigation-action-results";
import { type CompletionInput, completionInputSchema } from "@zoonk/player/completion-input-schema";
import { buildScoringInput, computeActivityScore } from "@zoonk/player/compute-score";
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

  // Revalidate outside after() so the signal is included in the RSC response.
  // This tells the client Router Cache to purge "/", ensuring the next
  // client-side navigation fetches fresh data from the server.
  // Placing it inside after() would run it after the response is sent,
  // meaning the client never receives the invalidation signal.
  revalidatePath("/");

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

      const score = computeActivityScore(
        buildScoringInput({
          activityKind: activity.kind,
          answers: input.answers,
          investigationLoop: input.investigationLoop,
          stepResults: stepResults.map((step) => ({ isCorrect: step.isCorrect })),
          steps: activity.steps.map((step) => ({
            content: step.content,
            id: String(step.id),
            kind: step.kind,
          })),
        }),
      );

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

      const investigationActionResults =
        activity.kind === "investigation"
          ? buildInvestigationActionResults({
              investigationLoop: input.investigationLoop,
              steps: activity.steps,
            })
          : [];

      await submitActivityCompletion({
        activityId: activity.id,
        durationSeconds,
        localDate: input.localDate,
        score,
        startedAt: new Date(input.startedAt),
        stepResults: [...mergedStepResults, ...investigationActionResults],
        userId,
      });

      const cookieHeader = reqHeaders.get("cookie") ?? "";

      await Promise.allSettled([
        queueLessonRegeneration({
          cookieHeader,
          lesson: activity.lesson,
        }),
        preloadNextLesson(activityId, cookieHeader),
      ]);
    } catch (error) {
      logError("[submitCompletion] Failed to persist activity completion:", error);
    }
  });
}
