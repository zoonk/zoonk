import "server-only";
import { type ScoreResult } from "@zoonk/core/player/compute-score";
import { prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";

const MAX_ENERGY = 100;
const MIN_ENERGY = 0;

function clampEnergy(value: number): number {
  return Math.min(MAX_ENERGY, Math.max(MIN_ENERGY, value));
}

function getDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export async function submitActivityCompletion(input: {
  activityId: bigint;
  durationSeconds: number;
  isChallenge: boolean;
  organizationId: number;
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
    const completionField = input.isChallenge
      ? { challengesCompleted: { increment: 1 } }
      : { interactiveCompleted: { increment: 1 } };

    await tx.dailyProgress.upsert({
      create: {
        brainPowerEarned: input.score.brainPower,
        challengesCompleted: input.isChallenge ? 1 : 0,
        correctAnswers: input.score.correctCount,
        date: today,
        dayOfWeek: now.getDay(),
        energyAtEnd: clampedEnergy,
        incorrectAnswers: input.score.incorrectCount,
        interactiveCompleted: input.isChallenge ? 0 : 1,
        organizationId: input.organizationId,
        timeSpentSeconds: input.durationSeconds,
        userId: input.userId,
      },
      update: {
        brainPowerEarned: { increment: input.score.brainPower },
        correctAnswers: { increment: input.score.correctCount },
        energyAtEnd: clampedEnergy,
        incorrectAnswers: { increment: input.score.incorrectCount },
        timeSpentSeconds: { increment: input.durationSeconds },
        ...completionField,
      },
      where: {
        userDateOrg: {
          date: today,
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
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
