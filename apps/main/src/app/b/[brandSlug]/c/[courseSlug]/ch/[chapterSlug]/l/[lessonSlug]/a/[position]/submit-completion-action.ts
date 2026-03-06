"use server";

import { getReviewValidationSteps } from "@/data/activities/get-review-steps";
import { preloadNextLesson } from "@/data/progress/preload-next-lesson";
import { submitActivityCompletion } from "@/data/progress/submit-activity-completion";
import { auth } from "@zoonk/core/auth";
import { prisma } from "@zoonk/db";
import {
  type CompletionInput,
  type CompletionResult,
  completionInputSchema,
} from "@zoonk/player/completion-input-schema";
import { computeChallengeScore, computeScore } from "@zoonk/player/compute-score";
import { computeDimensions, hasNegativeDimension } from "@zoonk/player/dimensions";
import { validateAnswers } from "@zoonk/player/validate-answers";
import { safeAsync } from "@zoonk/utils/error";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

const MAX_DURATION_SECONDS = 7200;

function clampDuration(startedAt: number): number {
  const raw = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, Math.min(raw, MAX_DURATION_SECONDS));
}

export async function submitCompletion(rawInput: CompletionInput): Promise<CompletionResult> {
  const parsed = completionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return { status: "error" };
  }

  const input = parsed.data;

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    return { status: "unauthenticated" };
  }

  const userId = Number(session.user.id);

  const activityId = BigInt(input.activityId);

  const { data, error } = await safeAsync(async () => {
    const activity = await prisma.activity.findUnique({
      include: {
        lesson: { include: { chapter: true } },
        steps: {
          include: { sentence: true, word: true },
          omit: { visualContent: true },
          orderBy: { position: "asc" },
          where: { isPublished: true },
        },
      },
      where: { id: activityId },
    });

    if (!activity) {
      return null;
    }

    const stepsForValidation =
      activity.kind === "review"
        ? await getReviewValidationSteps(activity.lessonId, Object.keys(input.answers).map(BigInt))
        : activity.steps;

    const stepResults = validateAnswers(stepsForValidation, input.answers);
    const isChallenge = activity.kind === "challenge";

    const dimensions = isChallenge
      ? computeDimensions(stepResults.map((result) => result.effects))
      : {};

    const isSuccessful = !hasNegativeDimension(dimensions);

    const score = isChallenge
      ? computeChallengeScore({ dimensions, isSuccessful })
      : computeScore({
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
        effects: validated.effects,
        hourOfDay: timing?.hourOfDay ?? new Date().getHours(),
        isCorrect: validated.isCorrect,
        stepId: validated.stepId,
      };
    });

    return submitActivityCompletion({
      activityId: activity.id,
      courseId: activity.lesson.chapter.courseId,
      durationSeconds,
      isChallenge,
      localDate: input.localDate,
      organizationId: activity.organizationId,
      score,
      startedAt: new Date(input.startedAt),
      stepResults: mergedStepResults,
      userId,
    });
  });

  if (error || !data) {
    return { status: "error" };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}`);

  after(() => preloadNextLesson(activityId, reqHeaders.get("cookie") ?? ""));

  return {
    belt: data.belt,
    brainPower: data.brainPower,
    energyDelta: data.energyDelta,
    newTotalBp: data.newTotalBp,
    status: "success",
  };
}
