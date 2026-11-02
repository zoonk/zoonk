import { type TransactionClient } from "@zoonk/db";
import { clampEnergy } from "../../progress/energy";
import { upsertDailyProgress } from "../../stats/daily-progress";

/** Completion clock and decayed Energy read after taking the learner's progress lock. */
export type ProgressLock = { completedAt: Date; completionDate: Date; currentEnergy: number };

export type ProgressChange = { after: number; before: number };

export type SessionProgressDelta = {
  brainPower: number;
  correctAnswers: number;
  energyDelta: number;
  incorrectAnswers: number;
  seconds: number;
};

/** Requires the progress lock from getCompletionEnergyContext; full-meal rewards add Brain Power without interactive completion. */
export async function applySessionProgress(
  tx: TransactionClient,
  {
    completion,
    delta,
    lock,
    userId,
  }: { completion: boolean; delta: SessionProgressDelta; lock: ProgressLock; userId: string },
): Promise<{ brainPower: ProgressChange; energy: ProgressChange }> {
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

  return {
    brainPower: { after, before: after - delta.brainPower },
    energy: { after: energy, before: lock.currentEnergy },
  };
}
