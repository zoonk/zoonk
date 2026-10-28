import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type AnswerExplanation, prisma } from "@zoonk/db";
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

export async function saveAnswerExplanation({
  answer,
  explanation,
  language,
  provenance,
  target,
}: {
  answer: string;
  explanation: string;
  language: string;
  provenance: LibraryProvenance;
  target: AnswerExplanationTarget;
}): Promise<AnswerExplanation> {
  const normalizedAnswer = normalizeTypedAnswer(answer);

  if (!normalizedAnswer) {
    throw new Error("A blank answer has no explanation to store.");
  }

  await prisma.answerExplanation.createMany({
    data: [{ ...target, explanation, language, normalizedAnswer, ...toProvenanceData(provenance) }],
    skipDuplicates: true,
  });

  return prisma.answerExplanation.findUniqueOrThrow({
    where: getUniqueWhere({ language, normalizedAnswer, target }),
  });
}
