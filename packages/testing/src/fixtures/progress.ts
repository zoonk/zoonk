import { prisma } from "@zoonk/db";

type DailyProgressFixtureInput = {
  brainPowerEarned?: number;
  correctAnswers?: number;
  date: Date;
  energyAtEnd?: number;
  incorrectAnswers?: number;
  organizationId: number;
  userId: number;
};

export async function dailyProgressFixture(input: DailyProgressFixtureInput) {
  return prisma.dailyProgress.create({
    data: {
      brainPowerEarned: input.brainPowerEarned ?? 0,
      correctAnswers: input.correctAnswers ?? 0,
      date: input.date,
      dayOfWeek: input.date.getDay(),
      energyAtEnd: input.energyAtEnd ?? 0,
      incorrectAnswers: input.incorrectAnswers ?? 0,
      organizationId: input.organizationId,
      userId: input.userId,
    },
  });
}

export async function dailyProgressFixtureMany(
  inputs: DailyProgressFixtureInput[],
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
