import { prisma } from "@zoonk/db";

export function lessonRunFixture({
  endedAt = null,
  lessonId,
  startedAt = new Date(),
  studySessionId,
  userId,
}: {
  endedAt?: Date | null;
  lessonId: string;
  startedAt?: Date;
  studySessionId?: string;
  userId: string;
}) {
  const localDate = new Date(
    Date.UTC(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), startedAt.getUTCDate()),
  );

  return prisma.learningEvent.create({
    data: {
      contentIds: { lessonId, ...(studySessionId && { studySessionId }) },
      endedAt,
      hour: startedAt.getUTCHours(),
      kind: "lesson",
      lessonKind: "library",
      localDate,
      startedAt,
      titleSnapshot: "Test lesson",
      userId,
      weekday: localDate.getUTCDay(),
    },
  });
}
