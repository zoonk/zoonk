"use server";

import { submitActivityCompletion } from "@/data/progress/submit-activity-completion";
import { auth } from "@zoonk/core/auth";
import {
  type CompletionInput,
  completionInputSchema,
} from "@zoonk/core/player/completion-input-schema";
import { computeChallengeScore, computeScore } from "@zoonk/core/player/compute-score";
import { validateAnswers } from "@zoonk/core/player/validate-answers";
import { prisma } from "@zoonk/db";
import { type BeltLevelResult } from "@zoonk/utils/belt-level";
import { safeAsync } from "@zoonk/utils/error";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hasNegativeDimension } from "./has-negative-dimension";

export type CompletionResult =
  | {
      status: "success";
      belt: BeltLevelResult;
      brainPower: number;
      energyDelta: number;
      newTotalBp: number;
    }
  | { status: "error" }
  | { status: "unauthenticated" };

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

  const { data, error } = await safeAsync(async () => {
    const activity = await prisma.activity.findUnique({
      select: {
        id: true,
        kind: true,
        organizationId: true,
        steps: {
          orderBy: { position: "asc" },
          select: {
            content: true,
            id: true,
            kind: true,
            sentence: { select: { id: true, sentence: true, translation: true } },
            word: { select: { id: true } },
          },
          where: { isPublished: true },
        },
      },
      where: { id: BigInt(input.activityId) },
    });

    if (!activity) {
      return null;
    }

    const stepResults = validateAnswers(activity.steps, input.answers);
    const isChallenge = activity.kind === "challenge";
    const isSuccessful = !hasNegativeDimension(input.dimensions);

    const score = isChallenge
      ? computeChallengeScore({ dimensions: input.dimensions, isSuccessful })
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
      durationSeconds,
      isChallenge,
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

  return {
    belt: data.belt,
    brainPower: data.brainPower,
    energyDelta: data.energyDelta,
    newTotalBp: data.newTotalBp,
    status: "success",
  };
}
