import "server-only";
import { prisma } from "@zoonk/db";
import { type EssayDraft, essayAnswerSchema } from "../essay-contract";
import { type WritingResult, writtenAnswerSchema } from "../writing-contract";

type DraftsInput = { itemId: string; sessionId: string; userId: string };
type WritingDraftView = Omit<EssayDraft, "grade"> & { attemptId: string; grade: WritingResult };

export function loadEssayDrafts(
  input: DraftsInput & { format: "writing" },
): Promise<WritingDraftView[]>;
export function loadEssayDrafts(input: DraftsInput & { format?: "legacy" }): Promise<EssayDraft[]>;

export async function loadEssayDrafts({
  format = "legacy",
  itemId,
  sessionId,
  userId,
}: DraftsInput & { format?: "legacy" | "writing" }): Promise<(EssayDraft | WritingDraftView)[]> {
  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { answer: true, answeredAt: true, id: true },
    where: { itemId, studySessionId: sessionId, userId },
  });

  return attempts.flatMap((attempt): (EssayDraft | WritingDraftView)[] => {
    const metadata = { attemptId: attempt.id, submittedAt: attempt.answeredAt.toISOString() };

    if (format === "writing") {
      const answer = writtenAnswerSchema.safeParse(attempt.answer).data;
      return answer ? [{ ...metadata, grade: answer.grade, text: answer.text }] : [];
    }

    const answer = essayAnswerSchema.safeParse(attempt.answer).data;

    return answer ? [{ ...metadata, grade: answer.grade, text: answer.text }] : [];
  });
}
