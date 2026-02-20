import "server-only";
import { type ScoreResult } from "@zoonk/core/player/compute-score";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { DAILY_DECAY, MIN_ENERGY, MS_PER_DAY } from "@zoonk/utils/constants";
import { clampEnergy, computeDecayedEnergy, toUTCMidnight } from "@zoonk/utils/energy";

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

// Decay is org-independent: a user's energy decays globally regardless of
// which organization they were active in, so gap records use organizationId: null.
async function fillDecayGaps(
  tx: TransactionClient,
  userId: number,
  currentEnergy: number,
  lastActiveDate: Date,
  todayDate: Date,
): Promise<void> {
  const dayDiff = Math.round((todayDate.getTime() - lastActiveDate.getTime()) / MS_PER_DAY);

  if (dayDiff <= 1) {
    return;
  }

  const records = Array.from({ length: dayDiff - 1 }, (_, i) => {
    const date = new Date(lastActiveDate.getTime() + (i + 1) * MS_PER_DAY);
    const decayedEnergy = Math.max(MIN_ENERGY, currentEnergy - (i + 1) * DAILY_DECAY);

    return {
      date,
      dayOfWeek: date.getUTCDay(),
      energyAtEnd: decayedEnergy,
      organizationId: null as number | null,
      userId,
    };
  });

  await tx.dailyProgress.createMany({ data: records, skipDuplicates: true });
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
  courseId: number;
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
  const today = toUTCMidnight(now);

  return prisma.$transaction(async (tx) => {
    // Create StepAttempt records
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

    // ActivityProgress upsert
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

    // CourseUser + userCount (only on first completion per course)
    const { count } = await tx.courseUser.createMany({
      data: [{ courseId: input.courseId, userId: input.userId }],
      skipDuplicates: true,
    });

    if (count > 0) {
      await tx.course.update({
        data: { userCount: { increment: 1 } },
        where: { id: input.courseId },
      });
    }

    // Find existing UserProgress to apply decay
    const existingProgress = await tx.userProgress.findUnique({
      select: { currentEnergy: true, lastActiveAt: true },
      where: { userId: input.userId },
    });

    const decayedBase = existingProgress
      ? computeDecayedEnergy(existingProgress.currentEnergy, existingProgress.lastActiveAt, now)
      : 0;

    // Fill DailyProgress records for inactive days
    if (existingProgress) {
      const lastActiveDate = toUTCMidnight(existingProgress.lastActiveAt);
      await fillDecayGaps(tx, input.userId, existingProgress.currentEnergy, lastActiveDate, today);
    }

    const clampedEnergy = clampEnergy(decayedBase + input.score.energyDelta);

    // UserProgress upsert with absolute energy (decay already applied)
    const updatedProgress = await tx.userProgress.upsert({
      create: {
        currentEnergy: clampedEnergy,
        lastActiveAt: now,
        totalBrainPower: input.score.brainPower,
        userId: input.userId,
      },
      update: {
        currentEnergy: clampedEnergy,
        lastActiveAt: now,
        totalBrainPower: { increment: input.score.brainPower },
      },
      where: { userId: input.userId },
    });

    // DailyProgress upsert for today
    const field = getCompletionField(input);

    await upsertDailyProgress(tx, {
      clampedEnergy,
      date: today,
      dayOfWeek: now.getUTCDay(),
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
