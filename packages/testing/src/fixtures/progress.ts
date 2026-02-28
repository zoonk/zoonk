import { prisma } from "@zoonk/db";

export async function dailyProgressFixtureMany(
  inputs: {
    brainPowerEarned?: number;
    correctAnswers?: number;
    date: Date;
    energyAtEnd?: number;
    incorrectAnswers?: number;
    organizationId: number;
    userId: number;
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
      organizationId: input.organizationId,
      userId: input.userId,
    })),
  });
}

const DEFAULT_ENERGY = 50;

export async function userProgressFixture(attrs: {
  currentEnergy?: number;
  lastActiveAt?: Date;
  totalBrainPower?: bigint;
  userId: number;
}) {
  return prisma.userProgress.create({
    data: {
      currentEnergy: attrs.currentEnergy ?? DEFAULT_ENERGY,
      lastActiveAt: attrs.lastActiveAt ?? new Date(),
      totalBrainPower: attrs.totalBrainPower ?? 0n,
      userId: attrs.userId,
    },
  });
}
