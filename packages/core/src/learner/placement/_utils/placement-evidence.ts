import "server-only";
import { type ItemFormat, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type PlacementEvidence } from "../placement-beliefs";
import { isPlacementAnswer } from "./placement-answers";

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
    format: attempt.item?.format ?? "multipleChoice",
    outcome: getOutcome(attempt),
    skillId: attempt.skillId,
  };
}

function toEvidenceList(attempts: readonly AttemptRow[]): PlacementEvidence[] {
  return attempts.map((attempt) => toEvidence(attempt)).filter((item) => item !== null);
}

/** Returns evidence oldest first. */
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
