import "server-only";
import { prisma } from "@zoonk/db";
import { type LessonQualityPhase } from "@zoonk/db/enums";

type Problem = { code?: string; problem: string; screen: number | null; source: "code" | "review" };

export async function recordLessonQualityDecision({
  blocking = [],
  lessonId,
  minor = [],
  phase,
  reviewerRunId,
  writerRunId,
}: {
  blocking?: Problem[];
  lessonId: string;
  minor?: Problem[];
  phase: LessonQualityPhase;
  reviewerRunId?: string | null;
  writerRunId?: string;
}): Promise<void> {
  if (!writerRunId) {
    return;
  }

  const shared = await prisma.lesson.findFirst({
    select: { id: true },
    where: { id: lessonId, ownerId: null, visibility: "public" },
  });

  if (!shared) {
    return;
  }

  await prisma.lessonQualityDecision.createMany({
    data: {
      blocking,
      lessonId,
      minor,
      outcome: blocking.length === 0 ? "passed" : "needsFix",
      phase,
      reviewerRunId,
      writerRunId,
    },
    skipDuplicates: true,
  });
}
