import { prisma } from "@zoonk/db";

export async function stepAttemptFixture(attrs: {
  answer: object;
  answeredAt?: Date;
  dayOfWeek: number;
  durationSeconds: number;
  effects?: object;
  hourOfDay: number;
  isCorrect: boolean;
  organizationId?: number;
  stepId: bigint;
  userId: number;
}) {
  return prisma.stepAttempt.create({
    data: {
      answer: attrs.answer,
      answeredAt: attrs.answeredAt,
      dayOfWeek: attrs.dayOfWeek,
      durationSeconds: attrs.durationSeconds,
      effects: attrs.effects,
      hourOfDay: attrs.hourOfDay,
      isCorrect: attrs.isCorrect,
      organizationId: attrs.organizationId,
      stepId: attrs.stepId,
      userId: attrs.userId,
    },
  });
}
