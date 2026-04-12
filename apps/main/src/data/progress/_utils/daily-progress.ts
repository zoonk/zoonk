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
      userId: params.userId,
    };
  });

  await params.tx.dailyProgress.createMany({ data: records, skipDuplicates: true });
}

/**
 * Daily progress is a global learner timeline, so there is exactly one row per
 * user and day. Keeping the upsert logic here prevents every completion write
 * from rebuilding the same counter and energy updates inline.
 */
export async function upsertDailyProgress(
  tx: TransactionClient,
  params: {
    clampedEnergy: number;
    date: Date;
    dayOfWeek: number;
    durationSeconds: number;
    field: "interactiveCompleted" | "staticCompleted";
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

  await tx.dailyProgress.upsert({
    create: createData,
    update: updateData,
    where: {
      userDate: {
        date: params.date,
        userId: params.userId,
      },
    },
  });
}
