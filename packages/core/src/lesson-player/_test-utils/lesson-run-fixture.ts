import { type LearningEvent, prisma } from "@zoonk/db";

export function lessonRunFixture({
  endedAt = null,
  kind = "lesson",
  lessonId,
  lessonKind = "library",
  startedAt = new Date(),
  studySessionId,
  userId,
}: {
  endedAt?: Date | null;
  kind?: LearningEvent["kind"];
  lessonId: string;
  lessonKind?: string;
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
      kind,
      lessonKind,
      localDate,
      startedAt,
      titleSnapshot: "Test lesson",
      userId,
      weekday: localDate.getUTCDay(),
    },
  });
}
