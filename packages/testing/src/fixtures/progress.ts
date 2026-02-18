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

export async function dailyProgressFixtureMany(inputs: DailyProgressFixtureInput[]) {
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
  totalBrainPower?: bigint;
  userId: number;
}) {
  return prisma.userProgress.create({
    data: {
      currentEnergy: attrs.currentEnergy ?? DEFAULT_ENERGY,
      totalBrainPower: attrs.totalBrainPower ?? 0n,
      userId: attrs.userId,
    },
  });
}

export async function stepAttemptFixture(attrs: {
  answer: object;
  answeredAt?: Date;
  dayOfWeek?: number;
  durationSeconds: number;
  effects?: object;
  hourOfDay?: number;
  isCorrect: boolean;
  organizationId: number;
  stepId: bigint;
  userId: number;
}) {
  const answeredAt = attrs.answeredAt ?? new Date();

  return prisma.stepAttempt.create({
    data: {
      answer: attrs.answer,
      answeredAt,
      dayOfWeek: attrs.dayOfWeek ?? answeredAt.getDay(),
      durationSeconds: attrs.durationSeconds,
      effects: attrs.effects,
      hourOfDay: attrs.hourOfDay ?? answeredAt.getHours(),
      isCorrect: attrs.isCorrect,
      organizationId: attrs.organizationId,
      stepId: attrs.stepId,
      userId: attrs.userId,
    },
  });
}
