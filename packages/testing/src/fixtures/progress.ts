import { prisma } from "@zoonk/db";

export async function dailyProgressFixtureMany(
  inputs: {
    brainPowerEarned?: number;
    correctAnswers?: number;
    date: Date;
    energyAtEnd?: number;
    interactiveCompleted?: number;
    incorrectAnswers?: number;
    lessonsCompleted?: number;
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
      dayOfWeek: input.date.getUTCDay(),
      energyAtEnd: input.energyAtEnd ?? 0,
      incorrectAnswers: input.incorrectAnswers ?? 0,
      interactiveCompleted: input.interactiveCompleted ?? 0,
      lessonsCompleted: input.lessonsCompleted ?? 0,
      staticCompleted: input.staticCompleted ?? 0,
      timeSpentSeconds: input.timeSpentSeconds ?? 0,
      userId: input.userId,
    })),
  });
}

const DEFAULT_ENERGY = 50;

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
