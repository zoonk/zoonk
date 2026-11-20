import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type LessonQualityOutcome, type LessonQualityPhase } from "@zoonk/db/enums";

type Problem = { code?: string; problem: string; screen: number | null; source: "code" | "review" };

export type QualityEvidence = {
  attemptKey: string;
  phase: LessonQualityPhase;
  writerRunId: string;
  reviewerRunId?: string | null;
  blocking?: Problem[];
  minor?: Problem[];
};

export async function recordLessonQualityDecision({
  db = prisma,
  evidence,
  lessonId,
  outcome,
  version,
}: {
  db?: TransactionClient;
  evidence?: QualityEvidence;
  lessonId: string;
  outcome: LessonQualityOutcome;
  version?: number;
}): Promise<void> {
  if (!evidence?.writerRunId) {
    return;
  }

  const shared = await db.lesson.findFirst({
    select: { id: true },
    where: { id: lessonId, ownerId: null, visibility: "public" },
  });

  if (!shared) {
    return;
  }

  const { blocking = [], minor = [], ...decision } = evidence;

  await db.lessonQualityDecision.createMany({
    data: { ...decision, blocking, lessonId, minor, outcome, version },
    skipDuplicates: true,
  });
}
