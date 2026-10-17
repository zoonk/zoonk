import { type TransactionClient } from "@zoonk/db";
import { clampEnergy } from "../../progress/energy";
import { upsertDailyProgress } from "../../stats/daily-progress";

/**
 * What `getCompletionEnergyContext` returns once it holds the learner's progress lock: the clock
 * read after the lock and the Energy decayed through inactive days.
 */
export type ProgressLock = { completedAt: Date; completionDate: Date; currentEnergy: number };

export type SessionProgressDelta = {
  brainPower: number;
  correctAnswers: number;
  energyDelta: number;
  incorrectAnswers: number;
  seconds: number;
};

/**
 * Adds a session's Brain Power, Energy, answers and time to the learner's totals and today's row,
 * under the lock from `getCompletionEnergyContext`. A finished question block counts as an
 * interactive completion; the full meal only adds Brain Power. Returns the Brain Power total before
 * and after, so belts crossed can be celebrated.
 */
export async function applySessionProgress(
  tx: TransactionClient,
  {
    completion,
    delta,
    lock,
    userId,
  }: { completion: boolean; delta: SessionProgressDelta; lock: ProgressLock; userId: string },
): Promise<{ after: number; before: number }> {
  const energy = clampEnergy(lock.currentEnergy + delta.energyDelta);

  const progress = await tx.userProgress.update({
    data: {
      currentEnergy: energy,
      lastActiveAt: lock.completedAt,
      totalBrainPower: { increment: delta.brainPower },
    },
    where: { userId },
  });

  await upsertDailyProgress(tx, {
    clampedEnergy: energy,
    date: lock.completionDate,
    durationSeconds: delta.seconds,
    field: completion ? "interactiveCompleted" : null,
    lessonsCompleted: 0,
    score: {
      brainPower: delta.brainPower,
      correctCount: delta.correctAnswers,
      incorrectCount: delta.incorrectAnswers,
    },
    userId,
  });

  const after = Number(progress.totalBrainPower);
  return { after, before: after - delta.brainPower };
}
