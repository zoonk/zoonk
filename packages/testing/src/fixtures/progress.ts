import { prisma } from "@zoonk/db";

/**
 * Create daily progress rows in bulk for tests that need chart or history data.
 * The helper keeps per-row defaults in one place so test setup can focus on the
 * dates and counters that matter for the behavior under test.
 */
export async function dailyProgressFixtureMany(
  inputs: {
    brainPowerEarned?: number;
    correctAnswers?: number;
    date: Date;
    energyAtEnd?: number;
    interactiveCompleted?: number;
    incorrectAnswers?: number;
    staticCompleted?: number;
    timeSpentSeconds?: number;
    userId: string;
  }[],
) {
  return prisma.dailyProgress.createMany({
    data: inputs.map((input) => ({
      brainPowerEarned: input.brainPowerEarned ?? 0,
      correctAnswers: input.correctAnswers ?? 0,
      date: input.date,
      dayOfWeek: input.date.getDay(),
      energyAtEnd: input.energyAtEnd ?? 0,
      incorrectAnswers: input.incorrectAnswers ?? 0,
      interactiveCompleted: input.interactiveCompleted ?? 0,
      staticCompleted: input.staticCompleted ?? 0,
      timeSpentSeconds: input.timeSpentSeconds ?? 0,
      userId: input.userId,
    })),
  });
}

const DEFAULT_ENERGY = 50;

/**
 * Set the singleton UserProgress row for a test user.
 * Auth-created users already have a zeroed progress row, while lower-level
 * tests often create users directly without one. Upserting lets callers express
 * the desired progress state without caring which path created the user.
 */
export async function userProgressFixture(attrs: {
  currentEnergy?: number;
  lastActiveAt?: Date;
  totalBrainPower?: bigint;
  userId: string;
}) {
  const data = {
    currentEnergy: attrs.currentEnergy ?? DEFAULT_ENERGY,
    lastActiveAt: attrs.lastActiveAt ?? new Date(),
    totalBrainPower: attrs.totalBrainPower ?? 0n,
  };

  return prisma.userProgress.upsert({
    create: { ...data, userId: attrs.userId },
    update: data,
    where: { userId: attrs.userId },
  });
}
