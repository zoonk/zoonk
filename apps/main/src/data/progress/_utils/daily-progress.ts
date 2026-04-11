import { type TransactionClient } from "@zoonk/db";
import { type ScoreResult } from "@zoonk/player/compute-score";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { DAILY_DECAY, MIN_ENERGY } from "@zoonk/utils/energy";

/**
 * Daily progress tracks static and interactive completions separately so the
 * dashboard can distinguish passive reading from question-driven practice.
 * This helper keeps that classification in one place for every completion write.
 */
export function getCompletionField(input: {
  stepResults: unknown[];
}): "interactiveCompleted" | "staticCompleted" {
  if (input.stepResults.length === 0) {
    return "staticCompleted";
  }

  return "interactiveCompleted";
}

/**
 * Energy decay is global to the learner, not tied to a specific organization.
 * When the learner skips days, we materialize those missing daily progress rows
 * so charts and streak-like summaries can show the decay instead of jumping.
 */
export async function fillDecayGaps(params: {
  currentEnergy: number;
  lastActiveDate: Date;
  todayDate: Date;
  tx: TransactionClient;
  userId: number;
}): Promise<void> {
  const dayDiff = Math.round(
    (params.todayDate.getTime() - params.lastActiveDate.getTime()) / MS_PER_DAY,
  );

  if (dayDiff <= 1) {
    return;
  }

  const records = Array.from({ length: dayDiff - 1 }, (_, i) => {
    const date = new Date(params.lastActiveDate.getTime() + (i + 1) * MS_PER_DAY);
    const decayedEnergy = Math.max(MIN_ENERGY, params.currentEnergy - (i + 1) * DAILY_DECAY);

    return {
      date,
      dayOfWeek: date.getUTCDay(),
      energyAtEnd: decayedEnergy,
      organizationId: null as number | null,
      userId: params.userId,
    };
  });

  await params.tx.dailyProgress.createMany({ data: records, skipDuplicates: true });
}

/**
 * Daily progress rows use a nullable organization id, which means the regular
 * compound unique only works for organization-scoped records. This helper keeps
 * the two write paths aligned so completion writes do not have to repeat that
 * null-handling branch every time.
 */
export async function upsertDailyProgress(
  tx: TransactionClient,
  params: {
    clampedEnergy: number;
    date: Date;
    dayOfWeek: number;
    durationSeconds: number;
    field: "interactiveCompleted" | "staticCompleted";
    organizationId: number | null;
    score: ScoreResult;
    userId: number;
  },
): Promise<void> {
  const createData = {
    brainPowerEarned: params.score.brainPower,
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

  const existing = await tx.dailyProgress.findFirst({
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

    return;
  }

  await tx.dailyProgress.create({ data: createData });
}
