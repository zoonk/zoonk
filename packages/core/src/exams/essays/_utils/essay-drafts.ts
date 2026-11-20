import "server-only";
import { prisma } from "@zoonk/db";
import { type EssayDraft, type WrittenEssayDraft, essayAnswerSchema } from "../essay-contract";
import { writtenAnswerSchema } from "../writing-contract";

type DraftsInput = { itemId: string; sessionId: string; userId: string };

export function loadEssayDrafts(
  input: DraftsInput & { format: "writing" },
): Promise<WrittenEssayDraft[]>;
export function loadEssayDrafts(input: DraftsInput & { format?: "legacy" }): Promise<EssayDraft[]>;

export async function loadEssayDrafts({
  format = "legacy",
  itemId,
  sessionId,
  userId,
}: DraftsInput & { format?: "legacy" | "writing" }): Promise<(EssayDraft | WrittenEssayDraft)[]> {
  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { answer: true, answeredAt: true, id: true },
    where: { itemId, studySessionId: sessionId, userId },
  });

  return attempts.flatMap((attempt): (EssayDraft | WrittenEssayDraft)[] => {
    const metadata = { attemptId: attempt.id, submittedAt: attempt.answeredAt.toISOString() };

    if (format === "writing") {
      const answer = writtenAnswerSchema.safeParse(attempt.answer).data;
      return answer ? [{ ...metadata, grade: answer.grade, text: answer.text }] : [];
    }

    const answer = essayAnswerSchema.safeParse(attempt.answer).data;

    return answer ? [{ ...metadata, grade: answer.grade, text: answer.text }] : [];
  });
}
