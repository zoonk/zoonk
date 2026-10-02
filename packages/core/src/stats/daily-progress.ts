import { type TransactionClient } from "@zoonk/db";

/** What a finished lesson adds to the day, however it was scored. */
type DailyScore = { brainPower: number; correctCount: number; incorrectCount: number };

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
    durationSeconds: number;
    /** Null for Brain Power that isn't a completion, such as the full meal. */
    field: "interactiveCompleted" | "staticCompleted" | null;
    /** First completions only, so Activity counts each lesson once however often it's replayed. */
    lessonsCompleted: number;
    score: DailyScore;
    userId: string;
  },
): Promise<void> {
  const createData = {
    brainPowerEarned: params.score.brainPower,
    correctAnswers: params.score.correctCount,
    date: params.date,
    dayOfWeek: params.date.getUTCDay(),
    energyAtEnd: params.clampedEnergy,
    incorrectAnswers: params.score.incorrectCount,
    interactiveCompleted: params.field === "interactiveCompleted" ? 1 : 0,
    lessonsCompleted: params.lessonsCompleted,
    staticCompleted: params.field === "staticCompleted" ? 1 : 0,
    timeSpentSeconds: params.durationSeconds,
    userId: params.userId,
  };

  const updateData = {
    brainPowerEarned: { increment: params.score.brainPower },
    correctAnswers: { increment: params.score.correctCount },
    energyAtEnd: params.clampedEnergy,
    incorrectAnswers: { increment: params.score.incorrectCount },
    lessonsCompleted: { increment: params.lessonsCompleted },
    timeSpentSeconds: { increment: params.durationSeconds },
    ...(params.field ? { [params.field]: { increment: 1 } } : {}),
  };

  await tx.dailyProgress.upsert({
    create: createData,
    update: updateData,
    where: { userDate: { date: params.date, userId: params.userId } },
  });
}
