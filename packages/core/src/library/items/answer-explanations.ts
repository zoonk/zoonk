import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { type AnswerExplanation, type TransactionClient, prisma, sql } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";

export type AnswerExplanationTarget = { itemId: string } | { stepId: string };

function getUniqueWhere({
  language,
  normalizedAnswer,
  target,
}: {
  language: string;
  normalizedAnswer: string;
  target: AnswerExplanationTarget;
}) {
  return "itemId" in target
    ? { itemAnswer: { itemId: target.itemId, language, normalizedAnswer } }
    : { stepAnswer: { language, normalizedAnswer, stepId: target.stepId } };
}

export async function findAnswerExplanation({
  answer,
  language,
  target,
}: {
  answer: string;
  language: string;
  target: AnswerExplanationTarget;
}): Promise<AnswerExplanation | null> {
  const normalizedAnswer = normalizeTypedAnswer(answer);

  if (!normalizedAnswer) {
    return null;
  }

  return prisma.answerExplanation.findUnique({
    where: getUniqueWhere({ language, normalizedAnswer, target }),
  });
}

/**
 * Locks the row the explanation was written from while it's stored, so a fix that changes it
 * either waits for the insert and deletes it, or lands first and nothing is stored.
 */
async function holdsContent({
  target,
  targetContent,
  tx,
}: {
  target: AnswerExplanationTarget;
  targetContent: unknown;
  tx: TransactionClient;
}): Promise<boolean> {
  const content = JSON.stringify(targetContent);

  const rows = await tx.$queryRaw<unknown[]>(
    "itemId" in target
      ? sql`SELECT id FROM items WHERE id = ${target.itemId}::uuid AND content = ${content}::jsonb FOR SHARE`
      : sql`SELECT id FROM library_steps WHERE id = ${target.stepId}::uuid AND content = ${content}::jsonb FOR SHARE`,
  );

  return rows.length > 0;
}

/**
 * Null when the question or step no longer holds `targetContent`, the content the explanation was
 * written from: a content fix changed it meanwhile, so the explanation may describe another key.
 */
export async function saveAnswerExplanation({
  answer,
  explanation,
  language,
  provenance,
  target,
  targetContent,
}: {
  answer: string;
  explanation: string;
  language: string;
  provenance: LibraryProvenance;
  target: AnswerExplanationTarget;
  targetContent: unknown;
}): Promise<AnswerExplanation | null> {
  const normalizedAnswer = normalizeTypedAnswer(answer);

  if (!normalizedAnswer) {
    throw new Error("A blank answer has no explanation to store.");
  }

  return prisma.$transaction(async (tx) => {
    if (!(await holdsContent({ target, targetContent, tx }))) {
      return null;
    }

    await tx.answerExplanation.createMany({
      data: [
        { ...target, explanation, language, normalizedAnswer, ...toProvenanceData(provenance) },
      ],
      skipDuplicates: true,
    });

    return tx.answerExplanation.findUniqueOrThrow({
      where: getUniqueWhere({ language, normalizedAnswer, target }),
    });
  });
}
