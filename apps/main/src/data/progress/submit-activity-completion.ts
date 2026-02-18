import "server-only";
import { type ScoreResult } from "@zoonk/core/player/compute-score";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { MAX_ENERGY, MIN_ENERGY } from "@zoonk/utils/constants";

function getCompletionField(input: {
  isChallenge: boolean;
  stepResults: unknown[];
}): "challengesCompleted" | "interactiveCompleted" | "staticCompleted" {
  if (input.isChallenge) {
    return "challengesCompleted";
  }

  if (input.stepResults.length === 0) {
    return "staticCompleted";
  }

  return "interactiveCompleted";
}

function clampEnergy(value: number): number {
  return Math.min(MAX_ENERGY, Math.max(MIN_ENERGY, value));
}

function getDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

async function upsertDailyProgress(
  tx: TransactionClient,
  params: {
    clampedEnergy: number;
    date: Date;
    dayOfWeek: number;
    durationSeconds: number;
    field: "challengesCompleted" | "interactiveCompleted" | "staticCompleted";
    organizationId: number | null;
    score: ScoreResult;
    userId: number;
  },
): Promise<void> {
  const createData = {
    brainPowerEarned: params.score.brainPower,
    challengesCompleted: params.field === "challengesCompleted" ? 1 : 0,
    correctAnswers: params.score.correctCount,
    date: params.date,
    dayOfWeek: params.dayOfWeek,
    energyAtEnd: params.clampedEnergy,
    incorrectAnswers: params.score.incorrectCount,
    interactiveCompleted: params.field === "interactiveCompleted" ? 1 : 0,
    organizationId: params.organizationId,
    staticCompleted: params.field === "staticCompleted" ? 1 : 0,
    timeSpentSeconds: params.durationSeconds,
    userId: params.userId,
  };

  const updateData = {
    brainPowerEarned: { increment: params.score.brainPower },
    correctAnswers: { increment: params.score.correctCount },
    energyAtEnd: params.clampedEnergy,
    incorrectAnswers: { increment: params.score.incorrectCount },
    timeSpentSeconds: { increment: params.durationSeconds },
    [params.field]: { increment: 1 },
  };

  if (params.organizationId) {
    await tx.dailyProgress.upsert({
      create: createData,
      update: updateData,
      where: {
        userDateOrg: {
          date: params.date,
          organizationId: params.organizationId,
          userId: params.userId,
        },
      },
    });

    return;
  }

  // When organizationId is null, the compound unique can't be used.
  // Find an existing record by individual fields instead.
  const existing = await tx.dailyProgress.findFirst({
    select: { id: true },
    where: {
      date: params.date,
      organizationId: null,
      userId: params.userId,
    },
  });

  if (existing) {
    await tx.dailyProgress.update({
      data: updateData,
      where: { id: existing.id },
    });
  } else {
    await tx.dailyProgress.create({ data: createData });
  }
}

export async function submitActivityCompletion(input: {
  activityId: bigint;
  durationSeconds: number;
  isChallenge: boolean;
  organizationId: number | null;
  score: ScoreResult;
  startedAt: Date;
  stepResults: {
    answer: object;
    answeredAt: Date;
    dayOfWeek: number;
    durationSeconds: number;
    effects: object[];
    hourOfDay: number;
    isCorrect: boolean;
    stepId: bigint;
  }[];
  userId: number;
}): Promise<{
  belt: BeltLevelResult;
  brainPower: number;
  energyDelta: number;
  newTotalBp: number;
}> {
  const now = new Date();
  const today = getDateOnly(now);

  return prisma.$transaction(async (tx) => {
    // 1. Create StepAttempt records
    if (input.stepResults.length > 0) {
      await tx.stepAttempt.createMany({
        data: input.stepResults.map((step) => ({
          answer: step.answer,
          answeredAt: step.answeredAt,
          dayOfWeek: step.dayOfWeek,
          durationSeconds: step.durationSeconds,
          effects: step.effects.length > 0 ? step.effects : undefined,
          hourOfDay: step.hourOfDay,
          isCorrect: step.isCorrect,
          organizationId: input.organizationId,
          stepId: step.stepId,
          userId: input.userId,
        })),
      });
    }

    // 2. ActivityProgress upsert
    await tx.activityProgress.upsert({
      create: {
        activityId: input.activityId,
        completedAt: now,
        durationSeconds: input.durationSeconds,
        startedAt: input.startedAt,
        userId: input.userId,
      },
      update: {
        completedAt: now,
        durationSeconds: input.durationSeconds,
      },
      where: {
        userActivity: {
          activityId: input.activityId,
          userId: input.userId,
        },
      },
    });

    // 3. UserProgress upsert
    const updatedProgress = await tx.userProgress.upsert({
      create: {
        currentEnergy: clampEnergy(input.score.energyDelta),
        lastActiveAt: now,
        totalBrainPower: input.score.brainPower,
        userId: input.userId,
      },
      update: {
        currentEnergy: { increment: input.score.energyDelta },
        lastActiveAt: now,
        totalBrainPower: { increment: input.score.brainPower },
      },
      where: { userId: input.userId },
    });

    // Clamp energy if out of bounds after increment
    const clampedEnergy = clampEnergy(updatedProgress.currentEnergy);

    if (clampedEnergy !== updatedProgress.currentEnergy) {
      await tx.userProgress.update({
        data: { currentEnergy: clampedEnergy },
        where: { userId: input.userId },
      });
    }

    // 4. DailyProgress upsert
    const field = getCompletionField(input);

    await upsertDailyProgress(tx, {
      clampedEnergy,
      date: today,
      dayOfWeek: now.getDay(),
      durationSeconds: input.durationSeconds,
      field,
      organizationId: input.organizationId,
      score: input.score,
      userId: input.userId,
    });

    const newTotalBp = Number(updatedProgress.totalBrainPower);

    return {
      belt: calculateBeltLevel(newTotalBp),
      brainPower: input.score.brainPower,
      energyDelta: input.score.energyDelta,
      newTotalBp,
    };
  });
}
