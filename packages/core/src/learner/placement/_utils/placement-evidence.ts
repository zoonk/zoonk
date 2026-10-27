import "server-only";
import { type ItemFormat, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type PlacementEvidence } from "../placement-beliefs";
import { isPlacementAnswer } from "./placement-answers";

/** Most skills need one or two questions: more than 1000 answers on one goal's skills is noise. */
const MAX_EVIDENCE = 1000;

type AttemptRow = {
  answer: unknown;
  answeredAt: Date;
  durationMs: number;
  isCorrect: boolean;
  item: { format: ItemFormat } | null;
  itemId: string | null;
  localDate: Date;
  skillId: string | null;
  stepId: string | null;
  studySessionId: string | null;
};

function getOutcome(attempt: AttemptRow): PlacementEvidence["outcome"] {
  if (attempt.isCorrect) {
    return "correct";
  }

  return isJsonObject(attempt.answer) && attempt.answer.dontKnow === true ? "dontKnow" : "wrong";
}

function toEvidence(attempt: AttemptRow): PlacementEvidence | null {
  if (!attempt.skillId) {
    return null;
  }

  return {
    // Lesson screens aren't bank items; their questions are about as guessable as multiple choice.
    format: attempt.item?.format ?? "multipleChoice",
    outcome: getOutcome(attempt),
    skillId: attempt.skillId,
  };
}

function toEvidenceList(attempts: readonly AttemptRow[]): PlacementEvidence[] {
  return attempts.map((attempt) => toEvidence(attempt)).filter((item) => item !== null);
}

/**
 * The learner's answers on these skills, oldest first, as placement reads them: every answer
 * (`evidence`), the ones to placement's own questions (`placementAnswers`, see
 * `isPlacementAnswer`) and the questions already seen.
 */
export async function loadEvidence({
  skillIds,
  tx = prisma,
  userId,
}: {
  skillIds: string[];
  tx?: TransactionClient;
  userId: string;
}) {
  const attempts = await tx.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: {
      answer: true,
      answeredAt: true,
      durationMs: true,
      isCorrect: true,
      item: { select: { format: true } },
      itemId: true,
      localDate: true,
      skillId: true,
      stepId: true,
      studySessionId: true,
    },
    take: MAX_EVIDENCE,
    where: { skillId: { in: skillIds }, userId },
  });

  const chronological = attempts.toReversed();

  return {
    attempts: chronological,
    evidence: toEvidenceList(chronological),
    placementAnswers: toEvidenceList(chronological.filter((attempt) => isPlacementAnswer(attempt))),
    seenItemIds: new Set(chronological.map((attempt) => attempt.itemId)),
  };
}
